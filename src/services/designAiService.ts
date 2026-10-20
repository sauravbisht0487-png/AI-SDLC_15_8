import { getAIProvider } from "../ai/aiFactory";
import { aiError } from "../ai/errors";
import type { JsonSchema } from "../ai/AIProvider";
import type { IDesign } from "../models/Architecture";

interface ProjectContext {
  name: string;
  description?: string | undefined;
}
interface RequirementContext {
  title: string;
  description: string;
}
interface StoryContext {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

const COMPONENT_TYPES = ["frontend", "backend", "database", "external", "queue", "cache", "other"] as const;
const RELATIONSHIP_TYPES = ["one-to-one", "one-to-many", "many-to-many"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// ---------- schema sent to the AI ----------
const text = (description?: string): JsonSchema =>
  description ? { type: "string", description } : { type: "string" };
const flag: JsonSchema = { type: "boolean" };
const choice = (values: readonly string[]): JsonSchema => ({ type: "string", enum: [...values] });
const listOf = (items: JsonSchema): JsonSchema => ({ type: "array", items });
const shape = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const designSchema = shape({
  summary: text("2-3 sentence overview of the solution"),
  components: listOf(
    shape({
      name: text(),
      type: choice(COMPONENT_TYPES),
      responsibility: text(),
      technology: text(),
    }),
  ),
  entities: listOf(
    shape({
      name: text("PascalCase, singular, e.g. Order"),
      description: text(),
      fields: listOf(
        shape({
          name: text(),
          type: text("e.g. String, Number, Boolean, Date, ObjectId"),
          required: flag,
          description: text(),
        }),
      ),
      relationships: listOf(
        shape({
          target: text("name of another entity in this design"),
          type: choice(RELATIONSHIP_TYPES),
          description: text(),
        }),
      ),
    }),
  ),
  apiEndpoints: listOf(
    shape({
      method: choice(HTTP_METHODS),
      path: text("must start with /api"),
      description: text(),
      authRequired: flag,
      requestBody: text("short JSON shape, or empty string if none"),
      responseBody: text("short JSON shape"),
    }),
  ),
  techChoices: listOf(shape({ area: text(), choice: text(), reason: text() })),
  dataFlow: listOf(text("one step of the main request flow")),
});

// ---------- validating what comes back ----------
const bad = (message: string) => aiError("AI_INVALID_SHAPE", message);

const obj = (v: unknown, field: string): Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw bad(`${field} must be an object`);
  return v as Record<string, unknown>;
};
const list = (v: unknown, field: string): unknown[] => {
  if (!Array.isArray(v)) throw bad(`${field} must be an array`);
  return v;
};
const str = (v: unknown, field: string): string => {
  if (typeof v !== "string") throw bad(`${field} must be a string`);
  return v.trim();
};
const reqStr = (v: unknown, field: string): string => {
  const s = str(v, field);
  if (!s) throw bad(`${field} must not be empty`);
  return s;
};
const bool = (v: unknown, field: string): boolean => {
  if (typeof v !== "boolean") throw bad(`${field} must be a boolean`);
  return v;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], field: string): T => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  const match = allowed.find((a) => a.toLowerCase() === s);
  if (!match) throw bad(`${field} must be one of: ${allowed.join(", ")}`);
  return match;
};

const parseDesign = (raw: unknown): IDesign => {
  const root = obj(raw, "design");

  const components = list(root["components"], "components").map((c, i) => {
    const f = `components[${i}]`;
    const r = obj(c, f);
    return {
      name: reqStr(r["name"], `${f}.name`),
      type: oneOf(r["type"], COMPONENT_TYPES, `${f}.type`),
      responsibility: str(r["responsibility"], `${f}.responsibility`),
      technology: str(r["technology"], `${f}.technology`),
    };
  });
  if (components.length === 0) throw aiError("AI_EMPTY_RESPONSE", "AI design has no components");

  const entities = list(root["entities"], "entities").map((e, i) => {
    const f = `entities[${i}]`;
    const r = obj(e, f);
    return {
      name: reqStr(r["name"], `${f}.name`),
      description: str(r["description"], `${f}.description`),
      fields: list(r["fields"], `${f}.fields`).map((x, j) => {
        const ff = `${f}.fields[${j}]`;
        const fr = obj(x, ff);
        return {
          name: reqStr(fr["name"], `${ff}.name`),
          type: reqStr(fr["type"], `${ff}.type`),
          required: bool(fr["required"], `${ff}.required`),
          description: str(fr["description"], `${ff}.description`),
        };
      }),
      relationships: list(r["relationships"], `${f}.relationships`).map((x, j) => {
        const rf = `${f}.relationships[${j}]`;
        const rr = obj(x, rf);
        return {
          target: reqStr(rr["target"], `${rf}.target`),
          type: oneOf(rr["type"], RELATIONSHIP_TYPES, `${rf}.type`),
          description: str(rr["description"], `${rf}.description`),
        };
      }),
    };
  });

  const apiEndpoints = list(root["apiEndpoints"], "apiEndpoints").map((a, i) => {
    const f = `apiEndpoints[${i}]`;
    const r = obj(a, f);
    const path = reqStr(r["path"], `${f}.path`);
    if (!path.startsWith("/")) throw bad(`${f}.path must start with /`);
    return {
      method: oneOf(r["method"], HTTP_METHODS, `${f}.method`),
      path,
      description: str(r["description"], `${f}.description`),
      authRequired: bool(r["authRequired"], `${f}.authRequired`),
      requestBody: str(r["requestBody"], `${f}.requestBody`),
      responseBody: str(r["responseBody"], `${f}.responseBody`),
    };
  });

  const techChoices = list(root["techChoices"], "techChoices").map((t, i) => {
    const f = `techChoices[${i}]`;
    const r = obj(t, f);
    return {
      area: reqStr(r["area"], `${f}.area`),
      choice: reqStr(r["choice"], `${f}.choice`),
      reason: str(r["reason"], `${f}.reason`),
    };
  });

  const dataFlow = list(root["dataFlow"], "dataFlow").map((s, i) => reqStr(s, `dataFlow[${i}]`));

  return {
    summary: reqStr(root["summary"], "summary"),
    components,
    entities,
    apiEndpoints,
    techChoices,
    dataFlow,
  };
};

// ---------- public function ----------
export const generateDesign = async (input: {
  project: ProjectContext;
  requirement: RequirementContext;
  stories: StoryContext[];
}): Promise<{ design: IDesign; provider: string; model: string }> => {
  const { project, requirement, stories } = input;

  const storyText = stories
    .slice(0, 20)
    .map(
      (s, i) =>
        `${i + 1}. ${s.title}\n   ${s.description}\n   Acceptance criteria: ${s.acceptanceCriteria.join("; ")}`,
    )
    .join("\n");

  const prompt = `You are a senior software architect. Produce a system design for ONE requirement of an existing project.

Stack (fixed, do not change): React + TypeScript + Vite + Tailwind frontend; Node.js + Express + TypeScript backend; MongoDB with Mongoose; JWT authentication.

Project: ${project.name}
${project.description ? `Project description: ${project.description}` : ""}

Requirement: ${requirement.title}
${requirement.description}

User stories:
${storyText || "(none yet)"}

Rules:
- Design only what this requirement needs. No unrelated features.
- Keep it practical: at most 8 components, 8 entities, 15 API endpoints.
- Entity names are PascalCase and singular. Relationship targets must be names of entities in this design.
- Every API path starts with /api. Set authRequired to true unless the endpoint is truly public.
- requestBody and responseBody are short JSON shape descriptions, not full schemas.
- dataFlow lists the main request flow as ordered steps.
- Reuse existing infrastructure (MongoDB, JWT). Add a queue or cache only if clearly needed.`;

  const provider = getAIProvider();
  const raw = await provider.generateJson({
    prompt,
    schemaName: "system_design",
    schema: designSchema,
  });

  return { design: parseDesign(raw), provider: provider.name, model: provider.model };
};