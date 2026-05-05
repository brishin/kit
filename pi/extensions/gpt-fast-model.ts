import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { openaiCodexOAuthProvider } from "@mariozechner/pi-ai/oauth";

const PROVIDER = "openai-codex";
const FAST_MODEL_ID = "gpt-5.5-fast";
const SUBSCRIPTION_MODEL_ID = "gpt-5.5";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const gpt55Model = {
	name: "GPT-5.5",
	reasoning: true,
	thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
	input: ["text", "image"] as Array<"text" | "image">,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 272_000,
	maxTokens: 128_000,
};

export default function (pi: ExtensionAPI) {
	// Remove the first API-key-based experiment if it is still registered in a live session.
	pi.unregisterProvider("openai-fast");

	pi.registerProvider(PROVIDER, {
		name: "ChatGPT Plus/Pro (Codex Subscription)",
		baseUrl: "https://chatgpt.com/backend-api",
		api: "openai-codex-responses",
		oauth: {
			name: openaiCodexOAuthProvider.name,
			login: openaiCodexOAuthProvider.login,
			refreshToken: openaiCodexOAuthProvider.refreshToken,
			getApiKey: openaiCodexOAuthProvider.getApiKey,
		},
		models: [
			{
				id: SUBSCRIPTION_MODEL_ID,
				...gpt55Model,
			},
			{
				id: FAST_MODEL_ID,
				...gpt55Model,
				name: "GPT-5.5 Fast (Subscription Priority)",
			},
		],
	});

	pi.on("before_provider_request", (event) => {
		const payload = event.payload;
		if (!isRecord(payload) || payload.model !== FAST_MODEL_ID) return;

		return {
			...payload,
			model: SUBSCRIPTION_MODEL_ID,
			service_tier: "priority",
		};
	});

	pi.on("model_select", async (event, ctx) => {
		if (event.model.provider === PROVIDER && event.model.id === FAST_MODEL_ID) {
			ctx.ui.setStatus("gpt-fast-model", "codex: fast");
		} else {
			ctx.ui.setStatus("gpt-fast-model", undefined);
		}
	});
}
