import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Personal footer inspired by /Users/brian/.claude/claude-powerline.json
const BAR_WIDTH = 10;
const DAILY_CACHE_MS = 60_000;
const SESSION_DIR = process.env.PI_CODING_AGENT_SESSION_DIR ?? join(homedir(), ".pi", "agent", "sessions");
const CACHE_VERSION = 1;
const CACHE_FILE = join(homedir(), ".pi", "agent", "cache", "usage-footer-daily-cost.json");
const REFRESH_RETRY_MS = 10_000;
const STATUS_DENYLIST = new Set([
	"rewind",
	// @howaboua/pi-codex-conversion renders a "Codex adapter" footer/status line
	// when it enables its compatibility tools. This footer already exposes the
	// active model/provider, so suppress that duplicate line.
	"codex-adapter",
]);

const C = {
	reset: "\x1b[0m",
	branchBg: "#414868",
	branchFg: "#c0caf5",
	contextBg: "#1f2335",
	contextFg: "#7aa2f7",
	sessionBg: "#292e42",
	sessionFg: "#bb9af7",
	todayBg: "#24283b",
	todayFg: "#9ece6a",
	modelFg: "#565f89",
	dimFg: "#565f89",
	activeFg: "#9ece6a",
	idleFg: "#565f89",
};

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
	const h = hex.replace("#", "");
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function fg(hex: string, text: string): string {
	const [r, g, b] = hexToRgb(hex);
	return `\x1b[38;2;${r};${g};${b}m${text}${C.reset}`;
}

function bg(hex: string, text: string): string {
	const [r, g, b] = hexToRgb(hex);
	return `\x1b[48;2;${r};${g};${b}m${text}${C.reset}`;
}

function style(foreground: string, background: string, text: string): string {
	const [fr, fg_, fb] = hexToRgb(foreground);
	const [br, bg_, bb] = hexToRgb(background);
	return `\x1b[38;2;${fr};${fg_};${fb}m\x1b[48;2;${br};${bg_};${bb}m${text}${C.reset}`;
}

function powerline(prevBg: string, nextBg?: string): string {
	const [fr, fg_, fb] = hexToRgb(prevBg);
	if (!nextBg) return `\x1b[38;2;${fr};${fg_};${fb}m${C.reset}`;
	const [br, bg_, bb] = hexToRgb(nextBg);
	return `\x1b[38;2;${fr};${fg_};${fb}m\x1b[48;2;${br};${bg_};${bb}m${C.reset}`;
}

function segment(text: string, foreground: string, background: string): string {
	return style(foreground, background, ` ${text} `);
}

function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(cost >= 100 ? 0 : cost >= 10 ? 2 : 2)}`;
}

function todayStart(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

type FileCostCacheEntry = {
	mtimeMs: number;
	size: number;
	cost: number;
};

type PersistentDailyCostCache = {
	version: number;
	sessionDir: string;
	dayStart: number;
	dailyCost: number;
	computedAt: number;
	files: Record<string, FileCostCacheEntry>;
};

type JsonlFileStat = FileCostCacheEntry & { path: string };

let dailyCostCache = 0;
let dailyCostCacheAt = 0;
let dailyCostDayStart = todayStart();
let dailyCostRefreshInFlight = false;
let dailyCostCacheLoaded = false;
let dailyCostRefreshError: string | undefined;
let dailyCostNextRetryAt = 0;
let sessionCostCache = 0;
const fileCostCache = new Map<string, FileCostCacheEntry>();

function isFileCostCacheEntry(value: unknown): value is FileCostCacheEntry {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;
	return typeof entry.mtimeMs === "number" && typeof entry.size === "number" && typeof entry.cost === "number";
}

function loadPersistentDailyCostCache(): void {
	if (dailyCostCacheLoaded) return;
	dailyCostCacheLoaded = true;

	const start = todayStart();
	dailyCostDayStart = start;
	try {
		if (!existsSync(CACHE_FILE)) return;
		const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Partial<PersistentDailyCostCache>;
		if (parsed.version !== CACHE_VERSION || parsed.sessionDir !== SESSION_DIR || parsed.dayStart !== start) return;
		if (typeof parsed.dailyCost !== "number" || typeof parsed.computedAt !== "number" || typeof parsed.files !== "object" || parsed.files === null) return;

		dailyCostCache = parsed.dailyCost;
		dailyCostCacheAt = parsed.computedAt;
		fileCostCache.clear();
		for (const [path, entry] of Object.entries(parsed.files)) {
			if (isFileCostCacheEntry(entry)) fileCostCache.set(path, entry);
		}
	} catch {
		dailyCostCache = 0;
		dailyCostCacheAt = 0;
		fileCostCache.clear();
	}
}

async function savePersistentDailyCostCache(): Promise<void> {
	const files = Object.fromEntries(fileCostCache.entries());
	const payload: PersistentDailyCostCache = {
		version: CACHE_VERSION,
		sessionDir: SESSION_DIR,
		dayStart: dailyCostDayStart,
		dailyCost: dailyCostCache,
		computedAt: dailyCostCacheAt,
		files,
	};
	const tmp = `${CACHE_FILE}.tmp-${process.pid}-${Date.now()}`;
	await mkdir(dirname(CACHE_FILE), { recursive: true });
	await writeFile(tmp, JSON.stringify(payload), "utf8");
	await rename(tmp, CACHE_FILE);
}

async function listJsonlFileStats(dir: string): Promise<JsonlFileStat[]> {
	const out: JsonlFileStat[] = [];
	async function walk(current: string): Promise<void> {
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		await Promise.all(
			entries.map(async (ent) => {
				const p = join(current, ent.name);
				if (ent.isDirectory()) {
					await walk(p);
					return;
				}
				if (!ent.isFile() || !ent.name.endsWith(".jsonl")) return;
				try {
					const s = await stat(p);
					out.push({ path: p, mtimeMs: s.mtimeMs, size: s.size, cost: 0 });
				} catch {
					// File may have disappeared while scanning.
				}
			}),
		);
	}
	await walk(dir);
	return out;
}

const DAILY_COST_SCANNER_SCRIPT = String.raw`
const fs = require("node:fs");
const readline = require("node:readline");

function timestampMs(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function scanFile(file, dayStart) {
  let cost = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file.path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry?.type !== "message" || entry?.message?.role !== "assistant") continue;
      const ts = timestampMs(entry.message.timestamp ?? entry.timestamp);
      if (ts >= dayStart) cost += entry.message.usage?.cost?.total ?? 0;
    } catch {}
  }
  return { path: file.path, mtimeMs: file.mtimeMs, size: file.size, cost };
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", async () => {
  try {
    const payload = JSON.parse(input);
    const files = Array.isArray(payload.files) ? payload.files : [];
    const dayStart = typeof payload.dayStart === "number" ? payload.dayStart : 0;
    const results = [];
    for (const file of files) {
      try {
        results.push(await scanFile(file, dayStart));
      } catch {}
    }
    process.stdout.write(JSON.stringify({ files: results }));
  } catch (error) {
    process.stderr.write(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
});
`;

async function parseChangedFilesInChild(files: JsonlFileStat[], dayStart: number): Promise<JsonlFileStat[]> {
	if (files.length === 0) return [];
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["-e", DAILY_COST_SCANNER_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(stderr || `daily cost scanner exited with ${code}`));
				return;
			}
			try {
				const parsed = JSON.parse(stdout) as { files?: Array<JsonlFileStat> };
				resolve(parsed.files ?? []);
			} catch (error) {
				reject(error);
			}
		});
		child.stdin.end(JSON.stringify({ dayStart, files }));
	});
}

async function refreshDailyCost(): Promise<void> {
	const dayStart = todayStart();
	const stats = await listJsonlFileStats(SESSION_DIR);
	const seen = new Set<string>();
	const toParse: JsonlFileStat[] = [];
	let total = 0;

	for (const file of stats) {
		if (file.mtimeMs < dayStart) continue;
		seen.add(file.path);
		const cached = fileCostCache.get(file.path);
		if (cached && cached.mtimeMs === file.mtimeMs && cached.size === file.size) {
			total += cached.cost;
			continue;
		}
		toParse.push(file);
	}

	const parsedFiles = await parseChangedFilesInChild(toParse, dayStart);
	for (const file of parsedFiles) {
		fileCostCache.set(file.path, { mtimeMs: file.mtimeMs, size: file.size, cost: file.cost });
		total += file.cost;
	}

	for (const path of Array.from(fileCostCache.keys())) {
		if (!seen.has(path)) fileCostCache.delete(path);
	}

	dailyCostDayStart = dayStart;
	dailyCostCache = total;
	dailyCostCacheAt = Date.now();
	dailyCostRefreshError = undefined;
	await savePersistentDailyCostCache();
}

function handleDailyDayChange(): boolean {
	const start = todayStart();
	if (start === dailyCostDayStart) return false;
	dailyCostDayStart = start;
	dailyCostCache = 0;
	dailyCostCacheAt = 0;
	fileCostCache.clear();
	return true;
}

function scheduleDailyCostRefresh(requestRender?: () => void, force = false): void {
	const dayChanged = handleDailyDayChange();
	const now = Date.now();
	if (dailyCostRefreshInFlight) return;
	if (!force && !dayChanged && now - dailyCostCacheAt < DAILY_CACHE_MS) return;
	if (!force && dailyCostRefreshError && now < dailyCostNextRetryAt) return;

	dailyCostRefreshInFlight = true;
	void refreshDailyCost()
		.catch((error: unknown) => {
			dailyCostRefreshError = error instanceof Error ? error.message : String(error);
			dailyCostNextRetryAt = Date.now() + REFRESH_RETRY_MS;
		})
		.finally(() => {
			dailyCostRefreshInFlight = false;
			requestRender?.();
		});
}

function computeSessionCost(ctx: ExtensionContext): number {
	let cost = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			cost += ((entry.message as AssistantMessage).usage?.cost?.total ?? 0);
		}
	}
	return cost;
}

function contextText(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const percent = usage?.percent;
	const pctText = percent == null ? "?" : `${Math.round(percent)}%`;
	// Use floor so each dot represents a fully consumed 10% chunk.
	// This avoids overstating usage (e.g. 5% showing one dot, 95% showing a full bar).
	const filled = percent == null ? 0 : Math.max(0, Math.min(BAR_WIDTH, Math.floor((percent / 100) * BAR_WIDTH)));
	const bar = "▪".repeat(filled) + "▫".repeat(BAR_WIDTH - filled);
	return `${bar} ${pctText}/${formatTokens(contextWindow)}`;
}

function modelText(ctx: ExtensionContext, providerCount: number, thinkingLevel: string): string {
	const model = ctx.model;
	if (!model) return "no-model";
	let id = model.id
		.replace(/^claude-/, "")
		.replace(/-202\d{5,}$/, "")
		.replace(/-latest$/, "")
		.replace(/-20\d\d-\d\d-\d\d$/, "");
	if (id.includes("sonnet-4-5")) id = "sonnet-4.5";
	if (id.includes("opus-4-5")) id = "opus-4.5";
	const parts: string[] = [];
	if (providerCount > 1) parts.push(`(${model.provider})`);
	parts.push(id);
	if (model.reasoning) {
		parts.push(thinkingLevel === "off" ? "thinking off" : thinkingLevel);
	}
	const usingSubscription = model ? (ctx.modelRegistry as any).isUsingOAuth?.(model) : false;
	if (usingSubscription) parts.push("sub");
	return parts.join(" ");
}

function buildMainLeft(contextUsageText: string, branch: string | null, commitCount: number | undefined, active: boolean): string {
	const branchText = branch ?? "no git";
	const count = commitCount && commitCount > 0 ? ` (~${commitCount})` : "";
	const marker = active ? "●" : "○";
	const git = segment(`⎇ ${branchText}${count} ${marker}`, C.branchFg, C.branchBg);
	const context = segment(contextUsageText, C.contextFg, C.contextBg);
	const session = segment(`§ ${formatCost(sessionCostCache)}`, C.sessionFg, C.sessionBg);
	const today = segment(`☉ ${formatCost(dailyCostCache)}`, C.todayFg, C.todayBg);
	return [
		git,
		powerline(C.branchBg, C.contextBg),
		context,
		powerline(C.contextBg, C.sessionBg),
		session,
		powerline(C.sessionBg, C.todayBg),
		today,
		powerline(C.todayBg),
	].join("");
}

function appendRight(left: string, right: string, width: number): string {
	const rightStyled = fg(C.modelFg, right);
	const leftW = visibleWidth(left);
	const rightW = visibleWidth(rightStyled);
	if (leftW + 1 + rightW <= width) {
		return left + " ".repeat(width - leftW - rightW) + rightStyled;
	}
	const availableRight = width - leftW - 1;
	if (availableRight > 0) {
		const truncatedRight = truncateToWidth(rightStyled, availableRight, "");
		return left + " ".repeat(Math.max(1, width - leftW - visibleWidth(truncatedRight))) + truncatedRight;
	}
	return truncateToWidth(left, width, "…");
}

async function refreshCommitCount(cwd: string, requestRender?: () => void, set?: (count: number | undefined) => void) {
	try {
		let stdout = "";
		try {
			({ stdout } = await execFileAsync("git", ["rev-list", "--count", "@{upstream}..HEAD"], { cwd, timeout: 2000 }));
		} catch {
			({ stdout } = await execFileAsync("git", ["rev-list", "--count", "main..HEAD"], { cwd, timeout: 2000 }));
		}
		const n = Number(stdout.trim());
		set?.(Number.isFinite(n) ? n : undefined);
	} catch {
		set?.(undefined);
	} finally {
		requestRender?.();
	}
}

export default function (pi: ExtensionAPI) {
	let active = false;
	let commitCount: number | undefined;
	let requestRender: (() => void) | undefined;
	let currentCwd: string | undefined;
	let currentThinkingLevel = "off";
	let currentContextText = "▫".repeat(BAR_WIDTH) + " ?/0";

	function refreshContextText(ctx: ExtensionContext) {
		currentContextText = contextText(ctx);
	}

	function rerender(forceDaily = false) {
		if (forceDaily) scheduleDailyCostRefresh(requestRender, true);
		requestRender?.();
	}

	function install(ctx: ExtensionContext) {
		loadPersistentDailyCostCache();
		sessionCostCache = computeSessionCost(ctx);
		refreshContextText(ctx);
		currentCwd = ctx.cwd;
		currentThinkingLevel = pi.getThinkingLevel();
		void refreshCommitCount(ctx.cwd, requestRender, (n) => (commitCount = n));
		scheduleDailyCostRefresh(requestRender);
		ctx.ui.setFooter((tui, _theme, footerData) => {
			requestRender = () => tui.requestRender();
			scheduleDailyCostRefresh(requestRender);
			const unsub = footerData.onBranchChange(() => {
				void refreshCommitCount(ctx.cwd, requestRender, (n) => (commitCount = n));
				tui.requestRender();
			});

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const left = buildMainLeft(currentContextText, footerData.getGitBranch(), commitCount, active);
					const right = modelText(ctx, footerData.getAvailableProviderCount(), currentThinkingLevel);
					const oneLine = appendRight(left, right, width);
					const lines: string[] = [];

					if (visibleWidth(left) + 1 + visibleWidth(right) <= width) {
						lines.push(oneLine);
					} else {
						const branchAndContext = [
							segment(`⎇ ${footerData.getGitBranch() ?? "no git"}${commitCount && commitCount > 0 ? ` (~${commitCount})` : ""} ${active ? "●" : "○"}`, C.branchFg, C.branchBg),
							powerline(C.branchBg, C.contextBg),
							segment(currentContextText, C.contextFg, C.contextBg),
							powerline(C.contextBg),
						].join("");
						const spend = [
							segment(`§ ${formatCost(sessionCostCache)}`, C.sessionFg, C.sessionBg),
							powerline(C.sessionBg, C.todayBg),
							segment(`☉ ${formatCost(dailyCostCache)}`, C.todayFg, C.todayBg),
							powerline(C.todayBg),
						].join("");
						lines.push(truncateToWidth(branchAndContext, width, "…"));
						lines.push(appendRight(spend, right, width));
					}

					const statuses = Array.from(footerData.getExtensionStatuses().entries())
						.filter(([key]) => !STATUS_DENYLIST.has(key))
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([, text]) => sanitizeStatusText(text))
						.filter(Boolean);
					if (statuses.length > 0) {
						lines.push(truncateToWidth(fg(C.dimFg, statuses.join(" ")), width, fg(C.dimFg, "…")));
					}
					return lines;
				},
			};
		});
	}

	pi.on("session_start", (_event, ctx) => install(ctx));
	pi.on("agent_start", (_event, ctx) => {
		active = true;
		rerender();
	});
	pi.on("agent_end", (_event, ctx) => {
		active = false;
		rerender(true);
	});
	pi.on("message_end", (event, ctx) => {
		if (ctx.cwd !== currentCwd) currentCwd = ctx.cwd;
		refreshContextText(ctx);
		if (event.message.role === "assistant") {
			sessionCostCache += ((event.message as AssistantMessage).usage?.cost?.total ?? 0);
		}
		rerender(true);
	});
	pi.on("model_select", (_event, ctx) => {
		refreshContextText(ctx);
		rerender();
	});
	pi.on("thinking_level_select", (event) => {
		currentThinkingLevel = event.level;
		rerender();
	});
}
