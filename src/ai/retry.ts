export const withRetry = async <T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> => {
  let attempt = 1;
  for (;;) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      // exponential backoff (1s, 2s, ...) plus a little jitter
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      console.warn(`AI call failed, retry ${attempt}/${maxAttempts - 1} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
};