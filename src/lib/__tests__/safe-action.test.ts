import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeAction } from "@/lib/safe-action";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { logger } from "@/lib/logger";

describe("safeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the action's result when it succeeds", async () => {
    const result = await safeAction(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("returns { error: string } when the action throws", async () => {
    const result = await safeAction(() => {
      throw new Error("something went wrong");
    });
    expect(result).toEqual({ error: "Une erreur est survenue" });
  });

  it("returns the custom error message when provided and action throws", async () => {
    const result = await safeAction(
      () => Promise.reject(new Error("db error")),
      "Custom error message"
    );
    expect(result).toEqual({ error: "Custom error message" });
  });

  it("logs the error via logger when action throws an Error", async () => {
    const err = new Error("boom");
    await safeAction(() => {
      throw err;
    }, "Action failed");

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith("Action failed", {
      error: "boom",
      stack: err.stack,
    });
  });

  it("logs non-Error throws as strings", async () => {
    await safeAction(() => {
      throw "plain string error";
    }, "Oops");

    expect(logger.error).toHaveBeenCalledWith("Oops", {
      error: "plain string error",
      stack: undefined,
    });
  });

  it("works with actions that return { success: true }", async () => {
    const result = await safeAction(() =>
      Promise.resolve({ success: true as const })
    );
    expect(result).toEqual({ success: true });
  });

  it("passes through { error: 'custom error' } returned by the action without logging", async () => {
    const result = await safeAction(() =>
      Promise.resolve({ error: "custom error" })
    );
    expect(result).toEqual({ error: "custom error" });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does not log when the action succeeds", async () => {
    await safeAction(() => Promise.resolve("ok"));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("handles function that throws null", async () => {
    const result = await safeAction(() => {
      throw null;
    }, "Null thrown");

    expect(result).toEqual({ error: "Null thrown" });
    expect(logger.error).toHaveBeenCalledWith("Null thrown", {
      error: "null",
      stack: undefined,
    });
  });

  it("handles function that throws undefined", async () => {
    const result = await safeAction(() => {
      throw undefined;
    }, "Undefined thrown");

    expect(result).toEqual({ error: "Undefined thrown" });
    expect(logger.error).toHaveBeenCalledWith("Undefined thrown", {
      error: "undefined",
      stack: undefined,
    });
  });
});
