import { GoogleGenAI, Type } from "@google/genai";

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

// Typed errors so the controller can map them to the right HTTP status
// instead of everything collapsing into a bare 500.
export class AIServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
const aiError = (code: string, message: string) =>
  new AIServiceError(code, message);

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      acceptanceCriteria: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["title", "description", "acceptanceCriteria"],
  },
};

export const generateUserStories = async (
  requirementTitle: string,
  requirementDescription: string,
): Promise<GeneratedStory[]> => {
  const apiKey = process.env.GEMINI_API_KEY; // read inside function — same rule as JWT_SECRET
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a senior business analyst. Given a software requirement, break it down into 2-4 clear user stories.

Requirement title: ${requirementTitle}
Requirement description: ${requirementDescription}

Each user story should follow the format "As a [user type], I want [goal]" for the title, "So that [benefit]" for the description, and include 2-4 acceptance criteria.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  if (!response.text) {
    throw new Error("No text response from AI model");
  }

  return parseGeneratedStories(response.text);
};

const parseGeneratedStories = (rawText: string): GeneratedStory[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("AI response was not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a JSON array");
  }

  return parsed.map((item, index) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as any).title !== "string" ||
      typeof (item as any).description !== "string" ||
      !Array.isArray((item as any).acceptanceCriteria)
    ) {
      throw new Error(`AI response item at index ${index} has invalid shape`);
    }
    return item as GeneratedStory;
  });
};

const codeResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING },
      language: { type: Type.STRING },
      code: { type: Type.STRING },
    },
    required: ["filename", "language", "code"],
  },
};

export const generateCodeForStory = async (
  storyTitle: string,
  storyDescription: string,
  acceptanceCriteria: string[],
  project: ProjectContext,
  requirement: RequirementContext,
): Promise<GeneratedFile[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw aiError("AI_NOT_CONFIGURED", "GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a senior full-stack engineer working on a Node.js + Express + TypeScript + MongoDB backend, with a React + TypeScript + Vite + Tailwind frontend (MERN stack).

Project: ${project.name}
${project.description ? `Project description: ${project.description}` : ""}

Parent requirement: ${requirement.title}
Requirement description: ${requirement.description}

User story title: ${storyTitle}
Description: ${storyDescription}
Acceptance criteria:
${acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Decide for yourself which files are actually needed to implement ONLY this user story - it could be a backend model/controller/route/service file, a frontend page/component/API call file, or a mix. Do not generate unrelated features, and do not generate more than 6 files. Keep each file minimal and focused, with brief inline comments explaining key steps. Do not include imports for packages that don't exist in a standard MERN + TypeScript + Tailwind setup.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: codeResponseSchema,
      },
    });
  } catch (err: any) {
    
    if (err?.status === 429) {
      throw aiError(
        "AI_RATE_LIMIT",
        "Gemini API rate limit reached, please try again shortly",
      );
    }
    throw aiError("AI_REQUEST_FAILED", "Failed to reach the Gemini API");
  }

  if (!response.text) {
    throw aiError("AI_EMPTY_RESPONSE", "No text response from AI model");
  }

  return parseGeneratedFiles(response.text);
};

const parseGeneratedFiles = (rawText: string): GeneratedFile[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw aiError("AI_INVALID_SHAPE", "AI response was not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw aiError("AI_INVALID_SHAPE", "AI response was not a JSON array");
  }
  if (parsed.length === 0) {
    throw aiError("AI_EMPTY_RESPONSE", "AI did not return any files");
  }
  return parsed.map((item, index) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as any).filename !== "string" ||
      !(item as any).filename.trim() ||
      typeof (item as any).language !== "string" ||
      typeof (item as any).code !== "string" ||
      !(item as any).code.trim()
    ) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `AI response item at index ${index} has invalid shape`,
      );
    }
    return item as GeneratedFile;
  });
};
