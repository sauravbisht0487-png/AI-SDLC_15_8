// Typed errors so the controller can map them to the right HTTP status.
export class AIServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
  }
}

export const aiError = (code: string, message: string): AIServiceError =>
  new AIServiceError(code, message);

export const getErrorStatus = (err: unknown): number | undefined =>
  typeof err === "object" &&
  err !== null &&
  "status" in err &&
  typeof err.status === "number"
    ? err.status
    : undefined;