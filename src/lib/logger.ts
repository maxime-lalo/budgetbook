export const logger = {
  error: (message: string, context?: Record<string, unknown>) =>
    console.error(`[ERROR] ${message}`, context ?? ""),
  warn: (message: string, context?: Record<string, unknown>) =>
    console.warn(`[WARN] ${message}`, context ?? ""),
  info: (message: string, context?: Record<string, unknown>) =>
    console.info(`[INFO] ${message}`, context ?? ""),
};
