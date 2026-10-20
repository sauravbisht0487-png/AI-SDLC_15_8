import { aiError } from "./errors";

// Provider-neutral JSON Schema subset. Each provider converts it to its own format.
export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
    enum?: string[];
}

export interface GenerateJsonRequest {
  prompt: string;
  schemaName: string; // e.g. "user_stories"
  schema: JsonSchema; // root MUST be type "object"
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Returns parsed JSON. Structure is NOT validated here; callers validate. */
  generateJson(request: GenerateJsonRequest): Promise<unknown>;
}

export const parseJsonText = (text: string | null | undefined): unknown => {
  if (!text) {
    throw aiError("AI_EMPTY_RESPONSE", "No text response from AI model");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw aiError("AI_INVALID_SHAPE", "AI response was not valid JSON");
  }
};