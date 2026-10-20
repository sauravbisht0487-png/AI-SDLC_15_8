
import { getAIProvider } from "../ai/aiFactory";
import { aiError } from "../ai/errors";
import type { JsonSchema } from "../ai/AIProvider";

import { validateGeneratedFiles } from "../ai/validateFiles";

import { designJsonSchema, parseDesign } from "../ai/designSchema";
import type { IDesign } from "../models/Architecture";

// Re-exported so existing imports of AIServiceError keep working.
export { AIServiceError } from "../ai/errors";

interface GeneratedStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}
interface GeneratedFile {
  filename: string;
  language: string;
  code: string;
}
interface ProjectContext {
  name: string;
  description?: string | undefined;
}
interface RequirementContext {
  title: string;
  description: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

// Root must be an object (required by strict JSON-schema mode on most providers),
// so the arrays are wrapped: { stories: [...] } and { files: [...] }.
const storiesSchema: JsonSchema = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "acceptanceCriteria"],
        additionalProperties: false,
      },
    },
  },
  required: ["stories"],
  additionalProperties: false,
};

const codeSchema: JsonSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          language: { type: "string" },
          code: { type: "string" },
        },
        required: ["filename", "language", "code"],
        additionalProperties: false,
      },
    },
  },
  required: ["files"],
  additionalProperties: false,
};

export const generateUserStories = async (
  requirementTitle: string,
  requirementDescription: string,
): Promise<GeneratedStory[]> => {
  const prompt = `You are a senior business analyst. Given a software requirement, break it down into 2-4 clear user stories.

Requirement title: ${requirementTitle}
Requirement description: ${requirementDescription}

Each user story should follow the format "As a [user type], I want [goal]" for the title, "So that [benefit]" for the description, and include 2-4 acceptance criteria.`;

  const raw = await getAIProvider().generateJson({
    prompt,
    schemaName: "user_stories",
    schema: storiesSchema,
  });

  return parseGeneratedStories(raw);
};

const parseGeneratedStories = (raw: unknown): GeneratedStory[] => {
  const root = asRecord(raw);
  const items = root ? root["stories"] : undefined;
  if (!Array.isArray(items)) {
    throw aiError(
      "AI_INVALID_SHAPE",
      "AI response did not contain a 'stories' array",
    );
  }

  return items.map((item, index) => {
    const story = asRecord(item);
    if (!story) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `AI response item at index ${index} has invalid shape`,
      );
    }
    const { title, description, acceptanceCriteria } = story;
    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      !Array.isArray(acceptanceCriteria) ||
      !acceptanceCriteria.every((c) => typeof c === "string")
    ) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `AI response item at index ${index} has invalid shape`,
      );
    }
    return {
      title,
      description,
      acceptanceCriteria: acceptanceCriteria as string[],
    };
  });
};
// Compact text version of the design: cheaper on tokens than raw JSON.
const formatDesign = (design: IDesign): string => {
  const entities = design.entities
    .map((e) => {
      const fields = e.fields.map((f) => `${f.name}: ${f.type}${f.required ? "" : "?"}`).join(", ");
      const rels = e.relationships.map((r) => `${r.type} -> ${r.target}`).join(", ");
      return `- ${e.name} { ${fields} }${rels ? ` | relations: ${rels}` : ""}`;
    })
    .join("\n");

  const endpoints = design.apiEndpoints
    .map((a) => `- ${a.method} ${a.path}${a.authRequired ? " (auth required)" : ""}: ${a.description}`)
    .join("\n");

  const tech = design.techChoices.map((t) => `- ${t.area}: ${t.choice}`).join("\n");
  const flow = design.dataFlow.map((s, i) => `${i + 1}. ${s}`).join("\n");

  return [
    `Summary: ${design.summary}`,
    `Entities:\n${entities || "(none)"}`,
    `API endpoints:\n${endpoints || "(none)"}`,
    `Tech choices:\n${tech || "(none)"}`,
    `Data flow:\n${flow || "(none)"}`,
  ]
    .join("\n\n")
    .slice(0, 8000);
};
export const generateCodeForStory = async (
  storyTitle: string,
  storyDescription: string,
  acceptanceCriteria: string[],
  project: ProjectContext,
  requirement: RequirementContext,
  design?: IDesign | undefined,
): Promise<GeneratedFile[]> => {
  const prompt = `You are a senior full-stack engineer working on a Node.js + Express + TypeScript + MongoDB backend, with a React + TypeScript + Vite + Tailwind frontend (MERN stack). Every file path must be relative and start with "backend/" or "frontend/" (for example "backend/src/models/Order.ts" or "frontend/src/pages/Orders.tsx"). Never create or modify package.json, .env files or anything under .github.

Project: ${project.name}
${project.description ? `Project description: ${project.description}` : ""}

Parent requirement: ${requirement.title}
Requirement description: ${requirement.description}

User story title: ${storyTitle}
Description: ${storyDescription}
Acceptance criteria:
${acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
${
  design
    ? `System design for this requirement. Stay consistent with it: use these exact entity names, field names and API paths, and implement only the parts this user story needs.\n${formatDesign(design)}\n`
    : ""
}
Decide for yourself which files are actually needed to implement ONLY this user story - it could be a backend model/controller/route/service file, a frontend page/component/API call file, or a mix. Do not generate unrelated features, and do not generate more than 6 files. Keep each file minimal and focused, with brief inline comments explaining key steps. Do not include imports for packages that don't exist in a standard MERN + TypeScript + Tailwind setup.`;

  const raw = await getAIProvider().generateJson({
    prompt,
    schemaName: "generated_files",
    schema: codeSchema,
  });

  return validateGeneratedFiles(parseGeneratedFiles(raw));
};

const parseGeneratedFiles = (raw: unknown): GeneratedFile[] => {
  const root = asRecord(raw);
  const items = root ? root["files"] : undefined;
  if (!Array.isArray(items)) {
    throw aiError(
      "AI_INVALID_SHAPE",
      "AI response did not contain a 'files' array",
    );
  }
  if (items.length === 0) {
    throw aiError("AI_EMPTY_RESPONSE", "AI did not return any files");
  }

  return items.map((item, index) => {
    const file = asRecord(item);
    const { filename, language, code } = file ?? {};
    // Validate required file metadata and reject empty source content.
    if (
      typeof filename !== "string" ||
      !filename.trim() ||
      typeof language !== "string" ||
      typeof code !== "string" ||
      !code.trim()
    ) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `AI response item at index ${index} has invalid shape`,
      );
    }
    return { filename, language, code };
  });
};
export const generateArchitectureDesign = async (
  project: ProjectContext,
  requirement: RequirementContext,
  stories: { title: string; description: string; acceptanceCriteria: string[] }[],
): Promise<{ design: IDesign; provider: string; model: string }> => {
  const provider = getAIProvider();

  const storyText = stories.length
    ? stories
        .map(
          (s, i) =>
            `${i + 1}. ${s.title}\n   ${s.description}\n   Acceptance criteria: ${s.acceptanceCriteria.join("; ")}`,
        )
        .join("\n")
    : "(no user stories yet; design from the requirement alone)";

  const prompt = `You are a senior software architect. Produce a practical system design for the requirement below.

Project: ${project.name}
${project.description ? `Project description: ${project.description}` : ""}

Requirement: ${requirement.title}
${requirement.description}

User stories:
${storyText}

Constraints:
- Stack is fixed: React + TypeScript + Vite + Tailwind frontend; Node.js + Express + TypeScript backend; MongoDB + Mongoose. Do not propose other stacks.
- Backend layering is Route -> Middleware -> Controller -> Service -> Repository -> Model.
- Keep it proportionate to the requirement: at most 8 components, 10 entities, 25 API endpoints. No microservices unless clearly needed.
- component.type must be one of: frontend, backend, database, external, queue, cache, other.
- entity.fields: list business fields only (skip _id, createdAt, updatedAt). field.type is a simple type such as string, number, boolean, Date, ObjectId.
- relationship.type must be one of: one-to-one, one-to-many, many-to-many; relationship.target is another entity's name.
- apiEndpoints.method must be one of: GET, POST, PUT, PATCH, DELETE. Paths start with "/api/". requestBody and responseBody are short one-line shape descriptions ("" if none).
- dataFlow is an ordered list of short steps describing the main request flow.
- Use "" for any text field with nothing to say.`;

  const raw = await provider.generateJson({
    prompt,
    schemaName: "architecture_design",
    schema: designJsonSchema,
  });

  return { design: parseDesign(raw), provider: provider.name, model: provider.model };
};