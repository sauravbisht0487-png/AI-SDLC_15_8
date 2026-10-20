import { aiError } from "./errors";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 100_000;
const MAX_PATH_LENGTH = 200;
const ALLOWED_ROOTS = new Set(["backend", "frontend"]);
const BLOCKED_SEGMENTS = new Set(["node_modules", ".git", ".github"]);
const BLOCKED_FILENAMES = new Set(["package.json", "package-lock.json"]);

const fail = (message: string) => aiError("AI_INVALID_SHAPE", message);

// Returns a clean relative path (forward slashes) or throws.
export const normalizePath = (raw: string): string => {
  const path = raw.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");

  if (!path) throw fail("Generated file has an empty path");
  if (path.length > MAX_PATH_LENGTH) throw fail(`Generated path is too long: ${path.slice(0, 50)}...`);
  if (path.includes("\0")) throw fail("Generated path contains an invalid character");
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    throw fail(`Absolute paths are not allowed: ${path}`);
  }

  const segments = path.split("/");
  // "" catches "a//b" and trailing "/" (a directory, not a file)
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw fail(`Invalid path segments: ${path}`);
  }

  const lower = segments.map((s) => s.toLowerCase());
  if (lower.some((s) => BLOCKED_SEGMENTS.has(s) || s.startsWith(".env"))) {
    throw fail(`Path is not allowed: ${path}`);
  }
  if (BLOCKED_FILENAMES.has(lower[lower.length - 1]!)) {
    throw fail(`Generated code may not overwrite ${path}`);
  }
  if (lower.length < 2 || !ALLOWED_ROOTS.has(lower[0]!)) {
    throw fail(`Path must start with backend/ or frontend/: ${path}`);
  }

  return segments.join("/");
};

export const validateGeneratedFiles = <T extends { filename: string; code: string }>(
  files: T[],
): T[] => {
  if (files.length > MAX_FILES) {
    throw fail(`AI returned ${files.length} files, maximum is ${MAX_FILES}`);
  }

  const seen = new Set<string>();
  return files.map((file) => {
    const filename = normalizePath(file.filename);

    const key = filename.toLowerCase();
    if (seen.has(key)) throw fail(`Duplicate file path: ${filename}`);
    seen.add(key);

    if (Buffer.byteLength(file.code, "utf-8") > MAX_FILE_BYTES) {
      throw fail(`File too large (max ${MAX_FILE_BYTES} bytes): ${filename}`);
    }

    return { ...file, filename };
  });
};