import { logger } from "@/lib/logger";

/**
 * Wraps a server action with try/catch, logging unexpected errors.
 * Returns `{ error: string }` on catch — callers already check for `error`
 * via `"error" in result` or `result.error` before accessing other fields.
 */
export async function safeAction<T>(
  fn: () => Promise<T>,
  errorMessage = "Une erreur est survenue"
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    logger.error(errorMessage, {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return { error: errorMessage } as unknown as T;
  }
}
