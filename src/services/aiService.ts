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
  requirementDescription: string
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
    model: "gemini-3.6-flash" ,
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
  acceptanceCriteria: string[]
): Promise<GeneratedFile[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a senior full-stack engineer working on a Node.js + Express + TypeScript + MongoDB backend, with a React + TypeScript frontend.

Given this user story, generate the minimal code needed to implement it: one backend piece (an Express route/controller function) and one frontend piece (a simple React component or API call function).

User story title: ${storyTitle}
Description: ${storyDescription}
Acceptance criteria:
${acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Return 2 files: one backend (.ts), one frontend (.tsx). Keep code minimal, focused only on this story, with brief inline comments explaining key steps. Do not include imports for packages that don't exist in a standard MERN+TS setup.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: codeResponseSchema,
    },
  });

  if (!response.text) {
    throw new Error("No text response from AI model");
  }

  return parseGeneratedFiles(response.text);
};

const parseGeneratedFiles = (rawText: string): GeneratedFile[] => {
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
      typeof (item as any).filename !== "string" ||
      typeof (item as any).language !== "string" ||
      typeof (item as any).code !== "string"
    ) {
      throw new Error(`AI response item at index ${index} has invalid shape`);
    }
    return item as GeneratedFile;
  });
};