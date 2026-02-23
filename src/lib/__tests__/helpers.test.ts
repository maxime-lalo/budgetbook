import { describe, it, expect } from "vitest";
import { toNumber, round2, toDate, toISOString } from "../db/helpers";

describe("toNumber", () => {
  it("converts string to number", () => {
    expect(toNumber("42.50")).toBe(42.5);
  });

  it("passes through number values", () => {
    expect(toNumber(10)).toBe(10);
  });

  it("returns 0 for null", () => {
    expect(toNumber(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it("handles negative string", () => {
    expect(toNumber("-123.45")).toBe(-123.45);
  });

  it("returns NaN for NaN input", () => {
    // typeof NaN === "number", so toNumber passes it through
    expect(toNumber(NaN)).toBeNaN();
  });

  it("returns Infinity for Infinity input", () => {
    // typeof Infinity === "number", so toNumber passes it through
    expect(toNumber(Infinity)).toBe(Infinity);
  });

  it("returns NaN for empty string", () => {
    // parseFloat("") returns NaN
    expect(toNumber("")).toBeNaN();
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.005)).toBe(1.0);
    expect(round2(1.006)).toBe(1.01);
  });

  it("handles negative numbers", () => {
    expect(round2(-3.456)).toBe(-3.46);
  });

  it("does not change integers", () => {
    expect(round2(100)).toBe(100);
  });

  it("handles floating-point precision issues", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("handles negative floating-point edge case (-1.005)", () => {
    // -1.005 * 100 = -100.49999999999999 due to IEEE 754, so Math.round gives -100
    // This means round2(-1.005) = -1.00 (not -1.01) due to floating-point representation
    expect(round2(-1.005)).toBe(-1);
  });
});

describe("toDate", () => {
  it("returns null for null input", () => {
    expect(toDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toDate(undefined)).toBeNull();
  });

  it("passes through Date objects", () => {
    const d = new Date("2026-01-15");
    expect(toDate(d)).toBe(d);
  });

  it("converts string to Date", () => {
    const result = toDate("2026-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });
});

describe("toISOString", () => {
  it("returns null for null input", () => {
    expect(toISOString(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toISOString(undefined)).toBeNull();
  });

  it("converts Date to ISO string", () => {
    const d = new Date("2026-01-15T00:00:00Z");
    expect(toISOString(d)).toBe("2026-01-15T00:00:00.000Z");
  });

  it("converts string date to ISO string", () => {
    const result = toISOString("2026-01-15");
    expect(result).toContain("2026-01-15");
  });
});
