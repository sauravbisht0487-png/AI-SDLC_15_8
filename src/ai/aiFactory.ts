import { getAIConfig } from "../config/aiConfig";
import type { AIProvider } from "./AIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";

export const getAIProvider = (): AIProvider => {
  const config = getAIConfig();
  switch (config.provider) {
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model);
    case "openrouter":
      return new OpenRouterProvider(config.apiKey, config.model);
  }
};