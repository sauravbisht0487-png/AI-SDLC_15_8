import {
  parseJsonText,
  type AIProvider,
  type GenerateJsonRequest,
} from "./AIProvider";
import { aiError } from "./errors";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 90_000;

interface OpenRouterResponse {
  choices?: { message?: { content?: string | null } }[];
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateJson(request: GenerateJsonRequest): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: request.prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: request.schema,
            },
          },
          // Only route to providers that actually support json_schema.
          provider: { require_parameters: true },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      console.error("RAW OPENROUTER NETWORK ERROR:", err);
      throw aiError("AI_REQUEST_FAILED", "Failed to reach the OpenRouter API");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`OPENROUTER ERROR ${response.status}:`, body);
      if (response.status === 429) {
        throw aiError(
          "AI_RATE_LIMIT",
          "OpenRouter rate limit reached, please try again shortly",
        );
      }
      throw aiError(
        "AI_REQUEST_FAILED",
        `OpenRouter request failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as OpenRouterResponse;
    return parseJsonText(data.choices?.[0]?.message?.content);
  }
}