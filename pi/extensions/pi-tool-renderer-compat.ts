import { ToolExecutionComponent, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";

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
const TOOL_RENDERER_EXCLUDED_TOOL_NAMES = new Set(["view_image"]);
const PATCH_SYMBOL = Symbol.for("kit.pi-tool-renderer-compat.set-plan-result");
const TOOL_RENDERER_BYPASS_PATCH_SYMBOL = Symbol.for("kit.pi-tool-renderer-compat.tool-renderer-bypass");
const CONTAINER_CHROME_BYPASS_PATCH_SYMBOL = Symbol.for("kit.pi-tool-renderer-compat.container-chrome-bypass");
const VSTACK_TOOL_RENDERER_PATCH_SYMBOL = Symbol.for("vstack.pi-tool-renderer.tool-execution-renderer-patch.v2");

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

type ToolExecutionPrototypeLike = ToolExecutionComponentLike & {
	render?: (width: number) => string[];
	getCallRenderer?: GetResultRenderer;
	getResultRenderer?: GetResultRenderer;
	hasRendererDefinition?: (this: ToolExecutionComponentLike) => boolean;
	getRenderShell?: (this: ToolExecutionComponentLike) => string;
	[TOOL_RENDERER_BYPASS_PATCH_SYMBOL]?: ToolRendererBypassState;
	[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?: {
		originalRender?: (this: ToolExecutionComponentLike, width: number) => string[];
		originalGetCallRenderer?: GetResultRenderer;
		originalGetResultRenderer?: GetResultRenderer;
		originalHasRendererDefinition?: (this: ToolExecutionComponentLike) => boolean;
		originalGetRenderShell?: (this: ToolExecutionComponentLike) => string;
	};
};

type ToolRendererBypassState = {
	previousRender: (this: ToolExecutionComponentLike, width: number) => string[];
	previousGetCallRenderer?: GetResultRenderer;
	previousGetResultRenderer?: GetResultRenderer;
	previousHasRendererDefinition?: (this: ToolExecutionComponentLike) => boolean;
	previousGetRenderShell?: (this: ToolExecutionComponentLike) => string;
	nativeRender?: (this: ToolExecutionComponentLike, width: number) => string[];
	nativeGetCallRenderer?: GetResultRenderer;
	nativeGetResultRenderer?: GetResultRenderer;
	nativeHasRendererDefinition?: (this: ToolExecutionComponentLike) => boolean;
	nativeGetRenderShell?: (this: ToolExecutionComponentLike) => string;
	wrapper: (this: ToolExecutionComponentLike, width: number) => string[];
};

type ContainerLike = {
	toolName?: unknown;
	render: (width: number) => string[];
	[CONTAINER_CHROME_BYPASS_PATCH_SYMBOL]?: ContainerChromeBypassState;
};

type ContainerChromeBypassState = {
	previousRender: (this: ContainerLike, width: number) => string[];
	nativeRender: (this: ContainerLike, width: number) => string[];
	wrapper: (this: ContainerLike, width: number) => string[];
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

function isExcludedTool(component: { toolName?: unknown }): boolean {
	return typeof component.toolName === "string" && TOOL_RENDERER_EXCLUDED_TOOL_NAMES.has(component.toolName);
}

function isRecursiveRendererCandidate(candidate: unknown, current: Function): boolean {
	if (typeof candidate !== "function") return true;
	if (candidate === current) return true;
	// jiti/hot reloads can leave an older copy of this compatibility wrapper in
	// @vanillagreen's saved "original" slot. It has a different identity, so
	// identity checks alone are not enough. Treat any known patch wrapper as
	// non-native when selecting the renderer to delegate excluded tools to.
	return /^patched(?:ToolExecutionRender|GetCallRenderer|GetResultRenderer|HasRendererDefinition|GetRenderShell|ContainerToolChromeRender)$/.test(
		candidate.name,
	);
}

function chooseNative<T extends Function>(preferred: unknown, fallback: unknown, current: Function): T | undefined {
	if (!isRecursiveRendererCandidate(preferred, current)) return preferred as T;
	if (!isRecursiveRendererCandidate(fallback, current)) return fallback as T;
	return undefined;
}

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
	const proto = ToolExecutionComponent?.prototype as unknown as ToolExecutionPrototypeLike;
	if (!proto || typeof proto.getResultRenderer !== "function") return;
	if (proto[PATCH_SYMBOL]) return;

	const previousGetResultRenderer = proto.getResultRenderer;
	const wrapper: GetResultRenderer = function patchedGetResultRenderer(this: ToolExecutionComponentLike) {
		if (isExcludedTool(this)) return undefined;

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

function installToolRendererBypassForExcludedTools(pi: ExtensionAPI, componentClass: unknown = ToolExecutionComponent): void {
	const proto = (componentClass as { prototype?: unknown } | undefined)?.prototype as ToolExecutionPrototypeLike | undefined;
	if (!proto || typeof proto.render !== "function") return;

	const existing = proto[TOOL_RENDERER_BYPASS_PATCH_SYMBOL];
	if (existing && proto.render === existing.wrapper) return;

	const previousRender = proto.render;
	const previousGetCallRenderer = proto.getCallRenderer;
	const previousGetResultRenderer = proto.getResultRenderer;
	const previousHasRendererDefinition = proto.hasRendererDefinition;
	const previousGetRenderShell = proto.getRenderShell;

	let state: ToolRendererBypassState;
	const wrapper = function patchedToolExecutionRender(this: ToolExecutionComponentLike, width: number): string[] {
		if (isExcludedTool(this) && state.nativeRender) return state.nativeRender.call(this, width);
		return previousRender.call(this, width);
	};

	const nativeRender = chooseNative<(this: ToolExecutionComponentLike, width: number) => string[]>(
		proto[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?.originalRender,
		existing?.nativeRender ?? previousRender,
		wrapper,
	);
	const nativeGetCallRenderer = chooseNative<GetResultRenderer>(
		proto[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?.originalGetCallRenderer,
		existing?.nativeGetCallRenderer ?? previousGetCallRenderer,
		wrapper,
	);
	const nativeGetResultRenderer = chooseNative<GetResultRenderer>(
		proto[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?.originalGetResultRenderer,
		existing?.nativeGetResultRenderer ?? previousGetResultRenderer,
		wrapper,
	);
	const nativeHasRendererDefinition = chooseNative<(this: ToolExecutionComponentLike) => boolean>(
		proto[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?.originalHasRendererDefinition,
		existing?.nativeHasRendererDefinition ?? previousHasRendererDefinition,
		wrapper,
	);
	const nativeGetRenderShell = chooseNative<(this: ToolExecutionComponentLike) => string>(
		proto[VSTACK_TOOL_RENDERER_PATCH_SYMBOL]?.originalGetRenderShell,
		existing?.nativeGetRenderShell ?? previousGetRenderShell,
		wrapper,
	);

	state = {
		previousRender,
		previousGetCallRenderer,
		previousGetResultRenderer,
		previousHasRendererDefinition,
		previousGetRenderShell,
		nativeRender,
		nativeGetCallRenderer,
		nativeGetResultRenderer,
		nativeHasRendererDefinition,
		nativeGetRenderShell,
		wrapper,
	};

	if (typeof previousGetCallRenderer === "function") {
		proto.getCallRenderer = function patchedGetCallRenderer(this: ToolExecutionComponentLike) {
			if (isExcludedTool(this)) return state.nativeGetCallRenderer?.call(this);
			return previousGetCallRenderer.call(this);
		};
	}

	if (typeof previousGetResultRenderer === "function") {
		proto.getResultRenderer = function patchedGetResultRenderer(this: ToolExecutionComponentLike) {
			if (isExcludedTool(this)) return state.nativeGetResultRenderer?.call(this);
			return previousGetResultRenderer.call(this);
		};
	}

	if (typeof previousHasRendererDefinition === "function") {
		proto.hasRendererDefinition = function patchedHasRendererDefinition(this: ToolExecutionComponentLike) {
			if (isExcludedTool(this) && state.nativeHasRendererDefinition) return state.nativeHasRendererDefinition.call(this);
			return previousHasRendererDefinition.call(this);
		};
	}

	if (typeof previousGetRenderShell === "function") {
		proto.getRenderShell = function patchedGetRenderShell(this: ToolExecutionComponentLike) {
			if (isExcludedTool(this) && state.nativeGetRenderShell) return state.nativeGetRenderShell.call(this);
			return previousGetRenderShell.call(this);
		};
	}

	proto.render = wrapper;
	proto[TOOL_RENDERER_BYPASS_PATCH_SYMBOL] = state;

	pi.on("session_shutdown", () => {
		const current = proto[TOOL_RENDERER_BYPASS_PATCH_SYMBOL];
		if (!current || proto.render !== current.wrapper) return;
		proto.render = current.previousRender;
		if (current.previousGetCallRenderer) proto.getCallRenderer = current.previousGetCallRenderer;
		if (current.previousGetResultRenderer) proto.getResultRenderer = current.previousGetResultRenderer;
		if (current.previousHasRendererDefinition) proto.hasRendererDefinition = current.previousHasRendererDefinition;
		if (current.previousGetRenderShell) proto.getRenderShell = current.previousGetRenderShell;
		delete proto[TOOL_RENDERER_BYPASS_PATCH_SYMBOL];
	});
}

function installContainerChromeBypassForExcludedTools(pi: ExtensionAPI, containerClass: unknown = Container): void {
	const proto = (containerClass as { prototype?: unknown } | undefined)?.prototype as ContainerLike | undefined;
	if (!proto || typeof proto.render !== "function") return;

	const existing = proto[CONTAINER_CHROME_BYPASS_PATCH_SYMBOL];
	if (existing && proto.render === existing.wrapper) return;

	const previousRender = proto.render;
	const nativeRender = existing?.nativeRender ?? previousRender;
	const wrapper = function patchedContainerToolChromeRender(this: ContainerLike, width: number): string[] {
		if (isExcludedTool(this)) return nativeRender.call(this, width);
		return previousRender.call(this, width);
	};

	proto.render = wrapper;
	proto[CONTAINER_CHROME_BYPASS_PATCH_SYMBOL] = { previousRender, nativeRender, wrapper };

	pi.on("session_shutdown", () => {
		const current = proto[CONTAINER_CHROME_BYPASS_PATCH_SYMBOL];
		if (!current || proto.render !== current.wrapper) return;
		proto.render = current.previousRender;
		delete proto[CONTAINER_CHROME_BYPASS_PATCH_SYMBOL];
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
	installToolRendererBypassForExcludedTools(pi);
	installContainerChromeBypassForExcludedTools(pi);

	// @vanillagreen patches the package-installed @earendil namespace, while
	// this repo typechecks against @mariozechner. Patch both, and run once on the
	// next tick so this bypass remains top-most even if extension load order puts
	// @vanillagreen after this compatibility extension.
	const installRuntimeBypasses = async () => {
		try {
			const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
			const agent = await dynamicImport("@earendil-works/pi-coding-agent");
			if (agent?.ToolExecutionComponent) installToolRendererBypassForExcludedTools(pi, agent.ToolExecutionComponent);
			const tui = await dynamicImport("@earendil-works/pi-tui");
			if (tui?.Container) installContainerChromeBypassForExcludedTools(pi, tui.Container);
		} catch {
			// Optional runtime namespace only.
		}
	};
	void installRuntimeBypasses();
	setTimeout(() => void installRuntimeBypasses(), 0);
}
