import { compact, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { openaiCodexOAuthProvider } from "@mariozechner/pi-ai/oauth";

const PROVIDER = "openai-codex";
const FAST_MODEL_ID = "gpt-5.5-fast";
const SUBSCRIPTION_MODEL_ID = "gpt-5.5";

function isFastCodexModel(model: { provider?: string; id?: string } | undefined) {
	return model?.provider === PROVIDER && model.id === FAST_MODEL_ID;
}

const codexModelDefaults = {
	api: "openai-codex-responses" as const,
	provider: PROVIDER,
	baseUrl: "https://chatgpt.com/backend-api",
	reasoning: true,
	input: ["text", "image"] as Array<"text" | "image">,
	contextWindow: 272_000,
	maxTokens: 128_000,
};

const standardThinking = { xhigh: "xhigh", minimal: "low" };
const zeroCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const codexModels = [
	{
		id: "gpt-5.1",
		name: "GPT-5.1",
		...codexModelDefaults,
		cost: { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
	},
	{
		id: "gpt-5.1-codex-max",
		name: "GPT-5.1 Codex Max",
		...codexModelDefaults,
		cost: { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
	},
	{
		id: "gpt-5.1-codex-mini",
		name: "GPT-5.1 Codex Mini",
		...codexModelDefaults,
		thinkingLevelMap: { minimal: "medium", low: "medium", medium: "medium", high: "high" },
		cost: { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 },
	},
	{
		id: "gpt-5.2",
		name: "GPT-5.2",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
	},
	{
		id: "gpt-5.2-codex",
		name: "GPT-5.2 Codex",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
	},
	{
		id: "gpt-5.3-codex",
		name: "GPT-5.3 Codex",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
	},
	{
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3 Codex Spark",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		input: ["text"] as Array<"text" | "image">,
		cost: zeroCost,
		contextWindow: 128_000,
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
	},
	{
		id: "gpt-5.4-mini",
		name: "GPT-5.4 Mini",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
	},
	{
		id: SUBSCRIPTION_MODEL_ID,
		name: "GPT-5.5",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 },
	},
	{
		id: FAST_MODEL_ID,
		name: "GPT-5.5 Fast (Subscription Priority)",
		...codexModelDefaults,
		thinkingLevelMap: standardThinking,
		cost: zeroCost,
	},
];

export default function (pi: ExtensionAPI) {
	// Remove the first API-key-based experiment if it is still registered in a live session.
	pi.unregisterProvider("openai-fast");

	pi.registerProvider(PROVIDER, {
		name: "ChatGPT Plus/Pro (Codex Subscription)",
		baseUrl: "https://chatgpt.com/backend-api",
		api: "openai-codex-responses",
		oauth: openaiCodexOAuthProvider,
		models: codexModels,
	});

	pi.on("before_provider_request", (event) => {
		const payload = event.payload as Record<string, unknown> | undefined;
		if (payload?.model !== FAST_MODEL_ID) return;

		return { ...payload, model: SUBSCRIPTION_MODEL_ID, service_tier: "priority" };
	});

	pi.on("session_before_compact", async (event, ctx) => {
		if (!isFastCodexModel(ctx.model)) return;

		const model = ctx.modelRegistry.find(PROVIDER, SUBSCRIPTION_MODEL_ID);
		if (!model) return;

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok || !auth.apiKey) return;

		ctx.ui.notify(`Compacting with ${SUBSCRIPTION_MODEL_ID} (without fast tier)...`, "info");

		const result = await compact(
			event.preparation,
			model,
			auth.apiKey,
			auth.headers,
			event.customInstructions,
			event.signal,
		);

		return { compaction: result };
	});

	pi.on("model_select", async (event, ctx) => {
		ctx.ui.setStatus("gpt-fast-model", isFastCodexModel(event.model) ? "codex: fast" : undefined);
	});
}
