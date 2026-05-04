import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CMUX_TIMEOUT_MS = 2_000;
const MAX_PAYLOAD_CHARS = 10_000;
const TRUNCATION_NOTE = "\n\n[… truncated for cmux sidebar …]";

type ContentBlock = Record<string, unknown>;

type AssistantLikeMessage = {
	role: string;
	content?: unknown;
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

async function updateSidebar(message: string): Promise<boolean> {
	// `cmux log --level info` renders the latest log with a `circle.fill` dot.
	// A status/metadata row with no icon updates the sidebar without that dot.
	return runCmux(["set-status", "pi", message, "--format", "markdown", "--priority", "100"]);
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

function normalizePayload(text: string): string {
	return text
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
	const thinkingText: string[] = [];

	for (const block of blocks) {
		if (!isBlock(block)) continue;
		if (block.type === "text") {
			const text = getString(block.text);
			if (text?.trim()) visibleText.push(text);
		} else if (block.type === "thinking") {
			const thinking = getString(block.thinking) ?? getString(block.text);
			if (thinking?.trim()) thinkingText.push(thinking);
		}
	}

	const visible = normalizePayload(visibleText.join("\n\n"));
	if (visible) return capPayload(visible);

	const thinking = normalizePayload(thinkingText.join("\n\n"));
	if (thinking) return capPayload(thinking);

	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (event, ctx) => {
		if (event.reason !== "resume") return;
		const payload = getLastAssistantOutput(ctx);
		if (!payload) return;
		void updateSidebar(`[resumed]\n${payload}`);
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		const payload = formatAssistantOutput(event.message);
		if (!payload) return;
		void updateSidebar(payload);
	});
}
