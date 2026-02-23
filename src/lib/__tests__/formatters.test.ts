import { describe, it, expect } from "vitest";
import { formatCurrency, parseMonthParam, toMonthParam } from "../formatters";

describe("formatCurrency", () => {
  it("formats positive amount in EUR", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("56");
    expect(result).toContain("€");
  });

  it("formats negative amount", () => {
    const result = formatCurrency(-50);
    expect(result).toContain("50");
    expect(result).toContain("€");
  });

  it("formats zero without negative sign", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
    expect(result).not.toContain("-");
  });

  it("handles string input", () => {
    const result = formatCurrency("42.50");
    expect(result).toContain("42");
    expect(result).toContain("50");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid month string", () => {
    const result = parseMonthParam("2026-02");
    expect(result).toEqual({ year: 2026, month: 2 });
  });

  it("returns current month when no param", () => {
    const result = parseMonthParam();
    const now = new Date();
    expect(result.year).toBe(now.getFullYear());
    expect(result.month).toBe(now.getMonth() + 1);
  });

  it("handles January", () => {
    const result = parseMonthParam("2026-01");
    expect(result).toEqual({ year: 2026, month: 1 });
  });

  it("handles December", () => {
    const result = parseMonthParam("2026-12");
    expect(result).toEqual({ year: 2026, month: 12 });
  });
});

describe("toMonthParam", () => {
  it("formats year and month", () => {
    expect(toMonthParam(2026, 2)).toBe("2026-02");
  });

  it("pads single-digit months", () => {
    expect(toMonthParam(2026, 1)).toBe("2026-01");
  });

  it("does not pad double-digit months", () => {
    expect(toMonthParam(2026, 12)).toBe("2026-12");
  });
});
