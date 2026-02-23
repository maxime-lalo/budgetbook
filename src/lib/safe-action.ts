import { logger } from "@/lib/logger";

export type ActionResult<T> = T | { error: string };

/**
 * Wraps a server action with try/catch, logging unexpected errors.
 * Returns `{ error: string }` on catch — callers check via `"error" in result`.
 */
export async function safeAction<T>(
  fn: () => Promise<T>,
  errorMessage = "Une erreur est survenue"
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    logger.error(errorMessage, {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return { error: errorMessage };
  }
}
