import { ToolExecutionComponent, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

/**
 * Compatibility layer for the package-installed @vanillagreen/pi-tool-renderer.
 *
 * Coverage policy:
 * - @vanillagreen owns compact rendering for Pi built-ins such as read, bash,
 *   grep, find, ls, tool_batch, generic OpenAI-style tools, MCP tools, and
 *   apply_patch when the active tool does not define its own renderer.
 * - Other packages own their own renderers for Codex/Composer tools
 *   (exec_command, write_stdin, view_image, image_generation), Cursor replay
 *   tools (cursor, cursor_*), pi-plan helpers, pi-subagents, and pi-web-providers.
 * - This extension patches only confirmed local gaps: @ifi/pi-plan's
 *   set_plan result should show the full plan even when the row is collapsed,
 *   including for historical session rows; tool_batch bash children that use
 *   Codex-style `cmd` are normalized to Pi's `command` before execution.
 *
 * Cursor shell replay/fallback behavior is handled at the provider layer in the
 * local /Users/brian/Programming/pi-cursor-sdk fork, not here.
 */

const SET_PLAN_TOOL_NAME = "set_plan";
const PATCH_SYMBOL = Symbol.for("kit.pi-tool-renderer-compat.set-plan-result");

// Cursor native replay defaults to TTY-only. In cmux/other wrapped TUI
// environments stdout may not look like a TTY, which forces Cursor shell calls
// back into thinking traces. Enable native replay explicitly for this local
// setup so pi-cursor-sdk can emit bash tool rows and delegate rendering to
// @vanillagreen/pi-tool-renderer.
process.env.PI_CURSOR_NATIVE_TOOL_DISPLAY ??= "1";

type ResultRenderer = (result: ToolResultLike, options: ToolResultOptionsLike, theme: ThemeLike, context: unknown) => unknown;
type GetResultRenderer = (this: ToolExecutionComponentLike) => ResultRenderer | undefined;

type ToolExecutionComponentLike = {
	toolName?: unknown;
	[PATCH_SYMBOL]?: PatchState;
};

type PatchState = {
	previousGetResultRenderer: GetResultRenderer;
	wrapper: GetResultRenderer;
};

type ToolResultLike = {
	content?: Array<{ type?: string; text?: string }>;
	details?: unknown;
};

type ToolResultOptionsLike = { isPartial?: boolean };

type ThemeLike = {
	fg?: (role: string, text: string) => string;
};

function getPlanFromResult(result: ToolResultLike): string | undefined {
	const details = result.details;
	if (details && typeof details === "object" && "plan" in details) {
		const plan = (details as { plan?: unknown }).plan;
		if (typeof plan === "string" && plan.trim()) return plan.trim();
	}

	const text = result.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text;
	return text?.trim() ? text.trim() : undefined;
}

function color(theme: ThemeLike, role: string, text: string): string {
	return typeof theme.fg === "function" ? theme.fg(role, text) : text;
}

function renderSetPlanResult(result: ToolResultLike, options: ToolResultOptionsLike, theme: ThemeLike): Text {
	if (options.isPartial) return new Text(color(theme, "muted", "Writing plan..."), 0, 0);

	const plan = getPlanFromResult(result);
	if (!plan) {
		const fallback = result.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text ?? "(no output)";
		return new Text(fallback, 0, 0);
	}

	return new Text(`${color(theme, "success", "Plan written.")}\n${plan}`, 0, 0);
}

function installSetPlanRendererPatch(pi: ExtensionAPI): void {
	const proto = ToolExecutionComponent?.prototype as unknown as ToolExecutionComponentLike & {
		getResultRenderer?: GetResultRenderer;
	};
	if (!proto || typeof proto.getResultRenderer !== "function") return;
	if (proto[PATCH_SYMBOL]) return;

	const previousGetResultRenderer = proto.getResultRenderer;
	const wrapper: GetResultRenderer = function patchedGetResultRenderer(this: ToolExecutionComponentLike) {
		if (this.toolName !== SET_PLAN_TOOL_NAME) {
			return previousGetResultRenderer.call(this);
		}

		return ((result: ToolResultLike, options: ToolResultOptionsLike, theme: ThemeLike) =>
			renderSetPlanResult(result, options, theme)) as ResultRenderer;
	};

	proto.getResultRenderer = wrapper;
	proto[PATCH_SYMBOL] = { previousGetResultRenderer, wrapper };

	pi.on("session_shutdown", () => {
		const current = proto[PATCH_SYMBOL];
		if (!current || proto.getResultRenderer !== current.wrapper) return;
		proto.getResultRenderer = current.previousGetResultRenderer;
		delete proto[PATCH_SYMBOL];
	});
}

function normalizeBashCommandArg(args: Record<string, unknown>): void {
	if (typeof args.command === "string" && args.command.trim()) return;
	const cmd = args.cmd;
	if (typeof cmd !== "string" || !cmd.trim()) return;
	args.command = cmd;
	delete args.cmd;
}

function normalizeToolBatchBashCalls(input: Record<string, unknown>): void {
	const calls = input.calls;
	if (!Array.isArray(calls)) return;
	for (const raw of calls) {
		if (!raw || typeof raw !== "object") continue;
		const call = raw as Record<string, unknown>;
		const tool = call.tool ?? call.name;
		if (tool !== "bash") continue;

		const nestedKey = call.args !== undefined ? "args" : call.arguments !== undefined ? "arguments" : undefined;
		if (nestedKey !== undefined && call[nestedKey] && typeof call[nestedKey] === "object" && !Array.isArray(call[nestedKey])) {
			normalizeBashCommandArg(call[nestedKey] as Record<string, unknown>);
			continue;
		}

		normalizeBashCommandArg(call);
	}
}

function installToolBatchBashArgsPatch(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (event.toolName === "bash") {
			normalizeBashCommandArg(event.input as Record<string, unknown>);
			return;
		}
		if (event.toolName === "tool_batch") {
			normalizeToolBatchBashCalls(event.input as Record<string, unknown>);
		}
	});
}

export default function (pi: ExtensionAPI) {
	installSetPlanRendererPatch(pi);
	installToolBatchBashArgsPatch(pi);
}
