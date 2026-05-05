import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CMUX_TIMEOUT_MS = 2_000;
const MAX_PAYLOAD_CHARS = 10_000;
const TRUNCATION_NOTE = "\n\n[… truncated for cmux sidebar …]";
const CMUX_STATUS_KEY = "pi";

type ContentBlock = Record<string, unknown>;

type AssistantLikeMessage = {
	role: string;
	content?: unknown;
};

type CmuxIdentify = {
	caller?: {
		tab_ref?: string;
		surface_ref?: string;
	};
	focused?: {
		tab_ref?: string;
		surface_ref?: string;
	};
};

async function runCmux(args: string[], timeoutMs = CMUX_TIMEOUT_MS): Promise<boolean> {
	try {
		await execFileAsync("cmux", args, { timeout: timeoutMs });
		return true;
	} catch {
		// Running pi outside cmux or without the cmux CLI should be silent.
		return false;
	}
}

async function getCmuxIdentify(): Promise<CmuxIdentify | undefined> {
	try {
		const { stdout } = await execFileAsync("cmux", ["identify", "--json"], { timeout: CMUX_TIMEOUT_MS });
		return JSON.parse(stdout) as CmuxIdentify;
	} catch {
		// Running pi outside cmux or without the cmux CLI should be silent.
		return undefined;
	}
}

async function isCallerFocused(): Promise<boolean> {
	const identify = await getCmuxIdentify();
	if (!identify?.caller || !identify.focused) return false;

	if (identify.caller.surface_ref && identify.focused.surface_ref) {
		return identify.caller.surface_ref === identify.focused.surface_ref;
	}
	if (identify.caller.tab_ref && identify.focused.tab_ref) {
		return identify.caller.tab_ref === identify.focused.tab_ref;
	}
	return false;
}

async function getStatusKeys(): Promise<string[]> {
	try {
		const { stdout } = await execFileAsync("cmux", ["list-status"], { timeout: CMUX_TIMEOUT_MS });
		return stdout
			.split("\n")
			.map((line) => line.match(/^([^=\s]+)=/)?.[1])
			.filter((key): key is string => Boolean(key));
	} catch {
		// Running pi outside cmux or without the cmux CLI should be silent.
		return [];
	}
}

async function clearStatuses(): Promise<void> {
	const keys = await getStatusKeys();
	await Promise.all(keys.map((key) => runCmux(["clear-status", key])));
}

async function clearNotifications(): Promise<boolean> {
	return runCmux(["clear-notifications"]);
}

async function updateSidebar(message: string): Promise<boolean> {
	// `cmux log --level info` renders the latest log with a `circle.fill` dot.
	// A status/metadata row with no icon updates the sidebar without that dot.
	await clearStatuses();
	await clearNotifications();
	return runCmux(["set-status", CMUX_STATUS_KEY, message, "--format", "markdown", "--priority", "100"]);
}

async function notifyPiAgent(body: string): Promise<boolean> {
	await clearNotifications();
	return runCmux(["notify", "--title", "Pi Agent", "--body", body]);
}

function getLastAssistantOutput(ctx: ExtensionContext): string | undefined {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		return formatAssistantOutput(entry.message);
	}
	return undefined;
}

function isBlock(value: unknown): value is ContentBlock {
	return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function stripTerminalControlSequences(text: string): string {
	return text
		// OSC, PM, and APC sequences terminated by BEL or ST.
		.replace(/\x1b[\]()^_][\s\S]*?(?:\x07|\x1b\\)/g, "")
		// DCS and SOS sequences terminated by ST.
		.replace(/\x1b[PX][\s\S]*?\x1b\\/g, "")
		// CSI sequences, including common SGR terminal color codes.
		.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
		// Single-character ESC sequences.
		.replace(/\x1b[ -/]*[@-~]/g, "");
}

function normalizePayload(text: string): string {
	return stripTerminalControlSequences(text)
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function capPayload(text: string): string {
	if (text.length <= MAX_PAYLOAD_CHARS) return text;
	return text.slice(0, Math.max(0, MAX_PAYLOAD_CHARS - TRUNCATION_NOTE.length)).trimEnd() + TRUNCATION_NOTE;
}

export function formatAssistantOutput(message: AssistantLikeMessage): string | undefined {
	const content = message.content;
	const blocks = Array.isArray(content) ? content : typeof content === "string" ? [{ type: "text", text: content }] : [];
	const visibleText: string[] = [];

	for (const block of blocks) {
		if (!isBlock(block)) continue;
		if (block.type === "text") {
			const text = getString(block.text);
			if (text?.trim()) visibleText.push(text);
		}
	}

	const visible = normalizePayload(visibleText.join("\n\n"));
	if (visible) return capPayload(visible);

	return undefined;
}

async function handleAssistantTurnEnd(message: AssistantLikeMessage): Promise<void> {
	if (message.role !== "assistant") return;
	const payload = formatAssistantOutput(message);
	if (!payload) return;

	if (await isCallerFocused()) {
		await updateSidebar(payload);
	} else {
		await notifyPiAgent(payload);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (event, ctx) => {
		if (event.reason !== "resume") return;
		const payload = getLastAssistantOutput(ctx);
		if (!payload) return;
		void updateSidebar(`[resumed]\n${payload}`);
	});

	pi.on("turn_end", (event) => {
		void handleAssistantTurnEnd(event.message);
	});
}
