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

  it("resets the rate limit after the window expires", () => {
    vi.useFakeTimers();
    try {
      // Exhaust all 60 requests
      for (let i = 0; i < 60; i++) {
        checkRateLimit("10.0.0.1");
      }
      const blocked = checkRateLimit("10.0.0.1");
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);

      // Advance time past the 60s window
      vi.advanceTimersByTime(60001);

      const afterReset = checkRateLimit("10.0.0.1");
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(59);
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles empty IP string", () => {
    const result = checkRateLimit("");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("handles IPv6 address", () => {
    const result = checkRateLimit("::1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);

    const result2 = checkRateLimit("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(59);

    // Verify IPv6 addresses are tracked independently
    const result3 = checkRateLimit("::1");
    expect(result3.remaining).toBe(58);

    const result4 = checkRateLimit("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(result4.remaining).toBe(58);
  });
});
