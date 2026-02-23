import { describe, it, expect } from "vitest";
import { transactionSchema } from "../validators";

describe("transactionSchema", () => {
  const validTransaction = {
    label: "Test",
    amount: -50,
    date: null,
    month: 2,
    year: 2026,
    status: "PENDING",
    accountId: "acc_123",
    categoryId: "cat_123",
    isAmex: false,
    recurring: false,
  };

  it("validates a correct transaction", () => {
    const result = transactionSchema.safeParse(validTransaction);
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty accountId", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, accountId: "" });
    expect(result.success).toBe(false);
  });

  it("validates PRÉVUE status", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, status: "PRÉVUE" });
    expect(result.success).toBe(true);
  });

  it("requires note when CANCELLED", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, status: "CANCELLED" });
    expect(result.success).toBe(false);
  });

  it("allows CANCELLED with note", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, status: "CANCELLED", note: "Raison" });
    expect(result.success).toBe(true);
  });

  it("rejects same source and destination account", () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      destinationAccountId: "acc_123",
    });
    expect(result.success).toBe(false);
  });

  it("allows different source and destination", () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      destinationAccountId: "acc_456",
    });
    expect(result.success).toBe(true);
  });

  it("coerces string amount to number", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, amount: "-50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(-50);
    }
  });

  it("rejects month out of range", () => {
    expect(transactionSchema.safeParse({ ...validTransaction, month: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...validTransaction, month: 13 }).success).toBe(false);
  });
});
