import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks must be declared before any imports that use them ---

vi.mock("@/lib/db", () => {
  const insert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const findFirst = vi.fn();

  // Chainable builder helpers
  const makeChain = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.values = vi.fn().mockReturnValue(Promise.resolve());
    chain.set = vi.fn().mockReturnThis();
    chain.where = vi.fn().mockReturnValue(Promise.resolve());
    return chain;
  };

  insert.mockImplementation(() => makeChain());
  update.mockImplementation(() => makeChain());
  del.mockImplementation(() => makeChain());

  return {
    db: {
      insert,
      update,
      delete: del,
      query: {
        transactions: { findFirst },
      },
    },
    transactions: { id: "id", year: "year", month: "month" },
  };
});

vi.mock("@/lib/monthly-balance", () => ({
  recomputeMonthlyBalance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/revalidate", () => ({
  revalidateTransactionPages: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/helpers", () => ({
  toDbDate: vi.fn((d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString().split("T")[0];
  }),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-cuid-id"),
}));

// Logger is invoked by safeAction on error; silence it
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// --- Imports after mocks ---

import { insertTransaction, updateTransactionById, deleteTransactionById } from "@/lib/transaction-helpers";
import { db } from "@/lib/db";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { revalidateTransactionPages } from "@/lib/revalidate";
import type { TransactionInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    label: "Loyer",
    amount: -800,
    date: new Date("2026-02-01"),
    month: 2,
    year: 2026,
    status: "PENDING",
    accountId: "acc_abc",
    categoryId: "cat_xyz",
    subCategoryId: null,
    bucketId: null,
    isAmex: false,
    recurring: false,
    destinationAccountId: null,
    note: null,
    ...overrides,
  };
}

// Cast the mock to expose the inner spy helpers
const dbMock = db as unknown as {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  query: { transactions: { findFirst: ReturnType<typeof vi.fn> } };
};

const recomputeMock = recomputeMonthlyBalance as ReturnType<typeof vi.fn>;
const revalidateMock = revalidateTransactionPages as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default chainable stubs for insert / update / delete
  const makeChain = () => ({
    values: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  });

  dbMock.insert.mockImplementation(() => makeChain());
  dbMock.update.mockImplementation(() => makeChain());
  dbMock.delete.mockImplementation(() => makeChain());

  // findFirst resolves to undefined by default (transaction not found)
  dbMock.query.transactions.findFirst.mockResolvedValue(undefined);

  recomputeMock.mockResolvedValue(undefined);
  revalidateMock.mockReturnValue(undefined);
});

// ===========================================================================
// buildTransactionValues — tested indirectly through insertTransaction
// ===========================================================================

describe("buildTransactionValues (via insertTransaction)", () => {
  it("converts amount to decimal string before inserting", async () => {
    await insertTransaction(makeValidInput({ amount: -123.45 }));

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.amount).toBe("-123.45");
  });

  it("converts date to DB-formatted value", async () => {
    const date = new Date("2026-02-15");
    await insertTransaction(makeValidInput({ date }));

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.date).toBe("2026-02-15");
  });

  it("sets month and year from parsed data", async () => {
    await insertTransaction(makeValidInput({ month: 3, year: 2025 }));

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.month).toBe(3);
    expect(values.year).toBe(2025);
  });

  it("stores null date for recurring transactions", async () => {
    await insertTransaction(makeValidInput({ date: null }));

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.date).toBeNull();
  });
});

// ===========================================================================
// applyOverrides — tested indirectly through insertTransaction
// ===========================================================================

describe("applyOverrides (via insertTransaction)", () => {
  it("without overrides, leaves amount unchanged", async () => {
    await insertTransaction(makeValidInput({ amount: -50 }));

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.amount).toBe("-50");
  });

  it("with forceNegativeAmount, makes positive amount negative", async () => {
    await insertTransaction(makeValidInput({ amount: 200 }), { forceNegativeAmount: true });

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.amount).toBe("-200");
  });

  it("with forceNegativeAmount, keeps already-negative amount unchanged", async () => {
    await insertTransaction(makeValidInput({ amount: -200 }), { forceNegativeAmount: true });

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.amount).toBe("-200");
  });

  it("with forceIsAmex, overrides isAmex flag", async () => {
    await insertTransaction(makeValidInput({ isAmex: false }), { forceIsAmex: true });

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.isAmex).toBe(true);
  });

  it("with forceRecurring, overrides recurring flag", async () => {
    await insertTransaction(makeValidInput({ recurring: false }), { forceRecurring: true });

    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.recurring).toBe(true);
  });
});

// ===========================================================================
// insertTransaction
// ===========================================================================

describe("insertTransaction", () => {
  it("returns { success: true } for valid data", async () => {
    const result = await insertTransaction(makeValidInput());
    expect(result).toEqual({ success: true });
  });

  it("returns Zod field errors for invalid data", async () => {
    const result = await insertTransaction(makeValidInput({ label: "" }));
    expect(result).toHaveProperty("error");
    // The error should contain fieldErrors from Zod flatten()
    const errorResult = result as { error: unknown };
    expect(errorResult.error).toHaveProperty("label");
  });

  it("returns Zod field errors when amount is zero", async () => {
    const result = await insertTransaction(makeValidInput({ amount: 0 }));
    expect(result).toHaveProperty("error");
    const errorResult = result as { error: unknown };
    expect(errorResult.error).toHaveProperty("amount");
  });

  it("does not call db.insert when validation fails", async () => {
    await insertTransaction(makeValidInput({ label: "" }));
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("calls db.insert with the generated id", async () => {
    await insertTransaction(makeValidInput());
    expect(dbMock.insert).toHaveBeenCalledOnce();
    const insertChain = dbMock.insert.mock.results[0].value;
    const values = insertChain.values.mock.calls[0][0];
    expect(values.id).toBe("test-cuid-id");
  });

  it("calls recomputeMonthlyBalance with correct year and month", async () => {
    await insertTransaction(makeValidInput({ month: 2, year: 2026 }));
    expect(recomputeMock).toHaveBeenCalledWith(2026, 2);
  });

  it("calls revalidateTransactionPages after insert", async () => {
    await insertTransaction(makeValidInput());
    expect(revalidateMock).toHaveBeenCalledOnce();
  });

  it("returns { error: string } when db.insert throws", async () => {
    dbMock.insert.mockImplementation(() => {
      throw new Error("DB connection failed");
    });

    const result = await insertTransaction(makeValidInput());
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toBe("Erreur lors de la création");
  });

  it("uses custom error message when db throws", async () => {
    dbMock.insert.mockImplementation(() => {
      throw new Error("Constraint violation");
    });

    const result = await insertTransaction(makeValidInput(), undefined, "Custom error");
    expect((result as { error: string }).error).toBe("Custom error");
  });

  it("does not call revalidate when db.insert throws", async () => {
    dbMock.insert.mockImplementation(() => {
      throw new Error("DB error");
    });

    await insertTransaction(makeValidInput());
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// updateTransactionById
// ===========================================================================

describe("updateTransactionById", () => {
  it("returns { success: true } for valid data", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    const result = await updateTransactionById("tx_1", makeValidInput());
    expect(result).toEqual({ success: true });
  });

  it("returns Zod field errors for invalid data", async () => {
    const result = await updateTransactionById("tx_1", makeValidInput({ label: "" }));
    expect(result).toHaveProperty("error");
    const errorResult = result as { error: unknown };
    expect(errorResult.error).toHaveProperty("label");
  });

  it("does not call db.update when validation fails", async () => {
    await updateTransactionById("tx_1", makeValidInput({ amount: 0 }));
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("calls db.update with built transaction values", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await updateTransactionById("tx_1", makeValidInput({ amount: -999 }));

    expect(dbMock.update).toHaveBeenCalledOnce();
    const chain = dbMock.update.mock.results[0].value;
    const setArg = chain.set.mock.calls[0][0];
    expect(setArg.amount).toBe("-999");
  });

  it("calls recomputeMonthlyBalance for the new month", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await updateTransactionById("tx_1", makeValidInput({ month: 3, year: 2026 }));
    expect(recomputeMock).toHaveBeenCalledWith(2026, 3);
  });

  it("also recomputes balance for old month when month changes", async () => {
    // Transaction originally belonged to Feb 2026; now moved to Mar 2026
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await updateTransactionById("tx_1", makeValidInput({ month: 3, year: 2026 }));

    expect(recomputeMock).toHaveBeenCalledWith(2026, 3); // new month
    expect(recomputeMock).toHaveBeenCalledWith(2026, 2); // old month
    expect(recomputeMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT recompute old month when month is unchanged", async () => {
    // Transaction stays in Feb 2026
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await updateTransactionById("tx_1", makeValidInput({ month: 2, year: 2026 }));

    expect(recomputeMock).toHaveBeenCalledTimes(1);
    expect(recomputeMock).toHaveBeenCalledWith(2026, 2);
  });

  it("recomputes old month when year changes", async () => {
    // Transaction moves from Jan 2025 to Feb 2026
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2025, month: 1 });

    await updateTransactionById("tx_1", makeValidInput({ month: 2, year: 2026 }));

    expect(recomputeMock).toHaveBeenCalledWith(2026, 2);
    expect(recomputeMock).toHaveBeenCalledWith(2025, 1);
    expect(recomputeMock).toHaveBeenCalledTimes(2);
  });

  it("calls revalidateTransactionPages after update", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await updateTransactionById("tx_1", makeValidInput());
    expect(revalidateMock).toHaveBeenCalledOnce();
  });

  it("still succeeds when old transaction is not found (findFirst returns undefined)", async () => {
    // findFirst returns undefined: transaction was somehow missing; update proceeds anyway
    dbMock.query.transactions.findFirst.mockResolvedValue(undefined);

    const result = await updateTransactionById("tx_1", makeValidInput());
    expect(result).toEqual({ success: true });
    // Only new month recomputed
    expect(recomputeMock).toHaveBeenCalledTimes(1);
  });

  it("returns { error: string } when db.update throws", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });
    dbMock.update.mockImplementation(() => {
      throw new Error("Update failed");
    });

    const result = await updateTransactionById("tx_1", makeValidInput());
    expect((result as { error: string }).error).toBe("Erreur lors de la mise à jour");
  });
});

// ===========================================================================
// deleteTransactionById
// ===========================================================================

describe("deleteTransactionById", () => {
  it("returns { success: true } when transaction exists", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    const result = await deleteTransactionById("tx_1");
    expect(result).toEqual({ success: true });
  });

  it("returns { success: true } when transaction is not found", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue(undefined);

    const result = await deleteTransactionById("tx_1");
    expect(result).toEqual({ success: true });
  });

  it("calls db.delete", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await deleteTransactionById("tx_1");
    expect(dbMock.delete).toHaveBeenCalledOnce();
  });

  it("calls recomputeMonthlyBalance with the deleted transaction month", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2025, month: 11 });

    await deleteTransactionById("tx_1");
    expect(recomputeMock).toHaveBeenCalledWith(2025, 11);
  });

  it("does NOT call recomputeMonthlyBalance when transaction is not found", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue(undefined);

    await deleteTransactionById("tx_1");
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("calls revalidateTransactionPages after delete", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });

    await deleteTransactionById("tx_1");
    expect(revalidateMock).toHaveBeenCalledOnce();
  });

  it("calls revalidateTransactionPages even when transaction is not found", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue(undefined);

    await deleteTransactionById("tx_1");
    expect(revalidateMock).toHaveBeenCalledOnce();
  });

  it("returns { error: string } when db.delete throws", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });
    dbMock.delete.mockImplementation(() => {
      throw new Error("Delete failed");
    });

    const result = await deleteTransactionById("tx_1");
    expect((result as { error: string }).error).toBe("Erreur lors de la suppression");
  });

  it("uses custom error message when db throws", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });
    dbMock.delete.mockImplementation(() => {
      throw new Error("FK violation");
    });

    const result = await deleteTransactionById("tx_1", "Custom delete error");
    expect((result as { error: string }).error).toBe("Custom delete error");
  });

  it("does not call revalidate when db.delete throws", async () => {
    dbMock.query.transactions.findFirst.mockResolvedValue({ year: 2026, month: 2 });
    dbMock.delete.mockImplementation(() => {
      throw new Error("DB error");
    });

    await deleteTransactionById("tx_1");
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
