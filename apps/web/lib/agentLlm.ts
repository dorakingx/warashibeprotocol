import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** Default Groq chat model (Llama 3.3 — strong tool + JSON use cases). Override with `GROQ_MODEL`. */
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type ResolvedAgentLlm =
  | {
      ok: true;
      provider: "groq" | "openai";
      modelId: string;
      /** Pass to `generateText` / `generateObject` `model`. */
      model: LanguageModel;
    }
  | { ok: false; reason: "no_api_key" };

/**
 * Prefer **Groq** (`GROQ_API_KEY`) for hosted open-weight models with a generous free tier.
 * Falls back to **OpenAI** if only `OPENAI_API_KEY` is set.
 */
export function resolveAgentChatModel(): ResolvedAgentLlm {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey });
    const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    return {
      ok: true,
      provider: "groq",
      modelId,
      model: groq.languageModel(modelId),
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    const modelId =
      process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    return {
      ok: true,
      provider: "openai",
      modelId,
      model: openai(modelId),
    };
  }

  return { ok: false, reason: "no_api_key" };
}
