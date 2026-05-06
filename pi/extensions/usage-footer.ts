import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Personal footer inspired by /Users/brian/.claude/claude-powerline.json
const BAR_WIDTH = 10;
const DAILY_CACHE_MS = 60_000;
const SESSION_DIR = process.env.PI_CODING_AGENT_SESSION_DIR ?? join(homedir(), ".pi", "agent", "sessions");
const STATUS_DENYLIST = new Set(["rewind"]);

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

function sumSessionCost(ctx: ExtensionContext): number {
	let cost = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			cost += ((entry.message as AssistantMessage).usage?.cost?.total ?? 0);
		}
	}
	return cost;
}

function todayStart(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function timestampMs(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function* jsonlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, ent.name);
		if (ent.isDirectory()) yield* jsonlFiles(p);
		else if (ent.isFile() && ent.name.endsWith(".jsonl")) yield p;
	}
}

let dailyCacheAt = 0;
let dailyCache = 0;

function getDailyCost(force = false): number {
	const now = Date.now();
	if (!force && now - dailyCacheAt < DAILY_CACHE_MS) return dailyCache;
	const start = todayStart();
	let total = 0;
	try {
		for (const file of jsonlFiles(SESSION_DIR)) {
			const lines = readFileSync(file, "utf8").split("\n");
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const entry = JSON.parse(line);
					if (entry?.type !== "message" || entry?.message?.role !== "assistant") continue;
					const ts = timestampMs(entry.message.timestamp ?? entry.timestamp);
					if (ts >= start) {
						total += entry.message.usage?.cost?.total ?? 0;
					}
				} catch {
					// Ignore malformed or future-format lines.
				}
			}
		}
	} catch {
		// Keep footer rendering even if session scanning fails.
	}
	dailyCache = total;
	dailyCacheAt = now;
	return total;
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

function buildMainLeft(ctx: ExtensionContext, branch: string | null, commitCount: number | undefined, active: boolean): string {
	const branchText = branch ?? "no git";
	const count = commitCount && commitCount > 0 ? ` (~${commitCount})` : "";
	const marker = active ? "●" : "○";
	const git = segment(`⎇ ${branchText}${count} ${marker}`, C.branchFg, C.branchBg);
	const context = segment(contextText(ctx), C.contextFg, C.contextBg);
	const session = segment(`§ ${formatCost(sumSessionCost(ctx))}`, C.sessionFg, C.sessionBg);
	const today = segment(`☉ ${formatCost(getDailyCost())}`, C.todayFg, C.todayBg);
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

	function rerender(forceDaily = false) {
		if (forceDaily) dailyCacheAt = 0;
		requestRender?.();
	}

	function install(ctx: ExtensionContext) {
		currentCwd = ctx.cwd;
		currentThinkingLevel = pi.getThinkingLevel();
		void refreshCommitCount(ctx.cwd, requestRender, (n) => (commitCount = n));
		ctx.ui.setFooter((tui, _theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsub = footerData.onBranchChange(() => {
				void refreshCommitCount(ctx.cwd, requestRender, (n) => (commitCount = n));
				tui.requestRender();
			});

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const left = buildMainLeft(ctx, footerData.getGitBranch(), commitCount, active);
					const right = modelText(ctx, footerData.getAvailableProviderCount(), currentThinkingLevel);
					const oneLine = appendRight(left, right, width);
					const lines: string[] = [];

					if (visibleWidth(left) + 1 + visibleWidth(right) <= width) {
						lines.push(oneLine);
					} else {
						const branchAndContext = [
							segment(`⎇ ${footerData.getGitBranch() ?? "no git"}${commitCount && commitCount > 0 ? ` (~${commitCount})` : ""} ${active ? "●" : "○"}`, C.branchFg, C.branchBg),
							powerline(C.branchBg, C.contextBg),
							segment(contextText(ctx), C.contextFg, C.contextBg),
							powerline(C.contextBg),
						].join("");
						const spend = [
							segment(`§ ${formatCost(sumSessionCost(ctx))}`, C.sessionFg, C.sessionBg),
							powerline(C.sessionBg, C.todayBg),
							segment(`☉ ${formatCost(getDailyCost())}`, C.todayFg, C.todayBg),
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
	pi.on("message_end", (_event, ctx) => {
		if (ctx.cwd !== currentCwd) currentCwd = ctx.cwd;
		rerender(true);
	});
	pi.on("model_select", () => rerender());
	pi.on("thinking_level_select", (event) => {
		currentThinkingLevel = event.level;
		rerender();
	});
}
