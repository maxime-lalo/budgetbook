import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module between tests to get a fresh Map
let checkRateLimit: typeof import("../api-rate-limit").checkRateLimit;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../api-rate-limit");
  checkRateLimit = mod.checkRateLimit;
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("decrements remaining on each call", () => {
    checkRateLimit("1.2.3.4");
    const result = checkRateLimit("1.2.3.4");
    expect(result.remaining).toBe(58);
  });

  it("blocks after 60 requests", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("1.2.3.4");
    }
    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("1.2.3.4");
    }
    const blockedResult = checkRateLimit("1.2.3.4");
    expect(blockedResult.allowed).toBe(false);

    const otherResult = checkRateLimit("5.6.7.8");
    expect(otherResult.allowed).toBe(true);
    expect(otherResult.remaining).toBe(59);
  });
});
