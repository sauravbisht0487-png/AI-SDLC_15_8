import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { withRetry } from "./retry";
import {
  parseJsonText,
  type AIProvider,
  type GenerateJsonRequest,
  type JsonSchema,
} from "./AIProvider";
import { aiError, getErrorStatus } from "./errors";

const TYPE_MAP: Record<JsonSchema["type"], Type> = {
  object: Type.OBJECT,
  array: Type.ARRAY,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
};

// Gemini uses its own Type enum and rejects unknown keys like additionalProperties.
const toGeminiSchema = (schema: JsonSchema): Schema => {
  const out: Schema = { type: TYPE_MAP[schema.type] };
  if (schema.description) out.description = schema.description;
  if (schema.required) out.required = schema.required;
    if (schema.enum) out.enum = schema.enum;
    
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        toGeminiSchema(value),
      ]),
    );
  }
  return out;
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateJson(request: GenerateJsonRequest): Promise<unknown> {
    let text: string | undefined;
    try {
           const response = await withRetry(
        () =>
          this.client.models.generateContent({
            model: this.model,
            contents: request.prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: toGeminiSchema(request.schema),
            },
          }),
        (err) => [500, 503, 504].includes(getErrorStatus(err) ?? 0),
      );
      text = response.text;
    } catch (err: unknown) {
      console.error("RAW GEMINI ERROR:", err);
      if (getErrorStatus(err) === 429) {
        throw aiError(
          "AI_RATE_LIMIT",
          "Gemini API rate limit reached, please try again shortly",
        );
      }
            if (getErrorStatus(err) === 503) {
        throw aiError(
          "AI_UNAVAILABLE",
          "Gemini is overloaded right now, please try again in a minute",
        );
      }
      throw aiError("AI_REQUEST_FAILED", "Failed to reach the Gemini API");
    }
    return parseJsonText(text);
  }
}