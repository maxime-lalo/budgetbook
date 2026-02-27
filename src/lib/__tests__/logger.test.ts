import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  async function getLogger() {
    const mod = await import("@/lib/logger");
    return mod.logger;
  }

  it("outputs valid JSON to console", async () => {
    process.env.LOG_LEVEL = "debug";
    const logger = await getLogger();
    logger.info("test message", { userId: "abc" });

    expect(console.info).toHaveBeenCalledOnce();
    const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.message).toBe("test message");
    expect(parsed.userId).toBe("abc");
    expect(parsed.level).toBe("INFO");
  });

  it("includes a timestamp in ISO format", async () => {
    process.env.LOG_LEVEL = "debug";
    const logger = await getLogger();
    logger.info("ts test");

    const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.timestamp).toBeDefined();
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it("uses correct console method for each level", async () => {
    process.env.LOG_LEVEL = "debug";
    const logger = await getLogger();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(console.debug).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("filters debug logs when LOG_LEVEL is info", async () => {
    process.env.LOG_LEVEL = "info";
    const logger = await getLogger();

    logger.debug("should not appear");
    logger.info("should appear");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("filters debug and info when LOG_LEVEL is warn", async () => {
    process.env.LOG_LEVEL = "warn";
    const logger = await getLogger();

    logger.debug("no");
    logger.info("no");
    logger.warn("yes");
    logger.error("yes");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("only shows error when LOG_LEVEL is error", async () => {
    process.env.LOG_LEVEL = "error";
    const logger = await getLogger();

    logger.debug("no");
    logger.info("no");
    logger.warn("no");
    logger.error("yes");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("defaults to debug in development", async () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "development";
    const logger = await getLogger();

    logger.debug("visible");
    expect(console.debug).toHaveBeenCalledOnce();
  });

  it("defaults to info in production", async () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "production";
    const logger = await getLogger();

    logger.debug("hidden");
    logger.info("visible");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("works without meta", async () => {
    process.env.LOG_LEVEL = "debug";
    const logger = await getLogger();
    logger.info("no meta");

    const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.message).toBe("no meta");
    expect(Object.keys(parsed)).toEqual(["timestamp", "level", "message"]);
  });

  it("spreads meta fields into the JSON entry", async () => {
    process.env.LOG_LEVEL = "debug";
    const logger = await getLogger();
    logger.warn("with meta", { userId: "u1", amount: 42.5 });

    const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.userId).toBe("u1");
    expect(parsed.amount).toBe(42.5);
  });
});
