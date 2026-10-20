import { aiError } from "../ai/errors";

export type AIProviderName = "gemini" | "openrouter";

export interface AIConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

// Read env INSIDE the function (not at module top level), because dotenv
// may not have run yet when this module is first imported.
export const getAIConfig = (): AIConfig => {
  const provider = (process.env.AI_PROVIDER ?? "gemini").trim().toLowerCase();
  const modelFromEnv = process.env.AI_MODEL?.trim();

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw aiError("AI_NOT_CONFIGURED", "GEMINI_API_KEY is not configured");
    }
    return { provider, apiKey, model: modelFromEnv || DEFAULT_GEMINI_MODEL };
  }

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw aiError("AI_NOT_CONFIGURED", "OPENROUTER_API_KEY is not configured");
    }
    if (!modelFromEnv) {
      throw aiError(
        "AI_NOT_CONFIGURED",
        "AI_MODEL is required when AI_PROVIDER=openrouter",
      );
    }
    return { provider, apiKey, model: modelFromEnv };
  }

  throw aiError(
    "AI_NOT_CONFIGURED",
    `Unsupported AI_PROVIDER "${provider}". Use "gemini" or "openrouter".`,
  );
};