import type { Response } from "express";
import { AIServiceError } from "../ai/errors";

const STATUS_BY_CODE: Record<string, number> = {
  AI_RATE_LIMIT: 429,
  AI_UNAVAILABLE: 503,
  AI_REQUEST_FAILED: 502,
  AI_NOT_CONFIGURED: 500,
  AI_EMPTY_RESPONSE: 502,
  AI_INVALID_SHAPE: 502,
};

// Returns true if it handled the error (response already sent).
export const sendAIError = (res: Response, err: unknown): boolean => {
  if (!(err instanceof AIServiceError)) return false;

  const status = STATUS_BY_CODE[err.code] ?? 500;
  // Don't leak config details to the client.
  const message =
    err.code === "AI_NOT_CONFIGURED"
      ? "AI service is not configured on the server"
      : err.message;

  // `message` and `error` both included so existing frontend code keeps working.
  res.status(status).json({ message, error: message, code: err.code });
  return true;
};
