import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const PROVIDER = "openai-fast";
const FAST_MODEL_ID = "gpt-5.5-fast";
const API_MODEL_ID = "gpt-5.5";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function (pi: ExtensionAPI) {
	pi.registerProvider(PROVIDER, {
		name: "OpenAI Fast",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "OPENAI_API_KEY",
		api: "openai-responses",
		models: [
			{
				id: FAST_MODEL_ID,
				name: "GPT-5.5 Fast (Priority, 2.5x cost)",
				reasoning: true,
				thinkingLevelMap: { off: null, xhigh: "xhigh" },
				input: ["text", "image"],
				cost: {
					input: 12.5,
					output: 75,
					cacheRead: 1.25,
					cacheWrite: 0,
				},
				contextWindow: 1_050_000,
				maxTokens: 128_000,
			},
		],
	});

	pi.on("before_provider_request", (event) => {
		const payload = event.payload;
		if (!isRecord(payload) || payload.model !== FAST_MODEL_ID) return;

		return {
			...payload,
			model: API_MODEL_ID,
			service_tier: "priority",
		};
	});

	pi.on("model_select", async (event, ctx) => {
		if (event.model.provider === PROVIDER && event.model.id === FAST_MODEL_ID) {
			ctx.ui.setStatus("gpt-fast-model", "fast: priority (2.5x)");
		} else {
			ctx.ui.setStatus("gpt-fast-model", undefined);
		}
	});

}
