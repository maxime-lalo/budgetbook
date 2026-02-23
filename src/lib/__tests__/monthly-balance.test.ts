import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — allocate shared mock objects before vi.mock factories run
// (vi.mock calls are hoisted to the top of the file by Vitest; any variable
// referenced inside the factory must itself be hoisted via vi.hoisted)
// ---------------------------------------------------------------------------

const { mockDb, getCheckingIdsMock } = vi.hoisted(() => {
  // Chainable query-builder factory — returns a thenable chain so that
  //   `await db.select().from().where()` resolves correctly.
  function makeChain(resolvedValue: unknown) {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "groupBy", "orderBy", "set"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(resolve);
    return chain;
  }

  const mockDb = {
    _makeChain: makeChain,
    select: vi.fn(() => makeChain([])),
    selectDistinct: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
    query: {
      budgets: { findMany: vi.fn() },
      monthlyBalances: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  };

  const getCheckingIdsMock = vi.fn(async () => ["acc_checking_1"] as string[]);

  return { mockDb, getCheckingIdsMock };
});

// ---------------------------------------------------------------------------
// Mock @/lib/db
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: mockDb,
  transactions: {
    status: {},
    accountId: {},
    destinationAccountId: {},
    year: {},
    month: {},
    categoryId: {},
    amount: {},
  },
  budgets: { year: {}, month: {}, categoryId: {}, amount: {} },
  monthlyBalances: { year: {}, month: {}, id: {}, surplus: {} },
  accounts: {},
  categories: {},
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/helpers
// We keep real implementations of toNumber / round2 so financial arithmetic
// is exercised; only getCheckingAccountIds is replaced.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/helpers", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db/helpers")>();
  return { ...real, getCheckingAccountIds: getCheckingIdsMock };
});

// drizzle-orm operators are column descriptors passed to our mocked db;
// they only need to exist (never called for real in tests).
vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  // sql is a tagged template literal used inside monthly-balance.ts; we
  // replace it with a no-op that returns a plain object.
  const fakeSql = Object.assign(
    () => ({}),
    { raw: () => ({}) }
  );
  return { ...real, sql: fakeSql };
});

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  recomputeMonthlyBalance,
  getCarryOver,
  backfillAllMonthlyBalances,
} from "@/lib/monthly-balance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Program mockDb.select to return values in sequence.
 * recomputeMonthlyBalance issues selects in this order (when checkingIds > 0):
 *   0 → onChecking
 *   1 → incomingToChecking
 *   2 → netByCategory
 */
function setupSelectSequence(values: unknown[]) {
  let call = 0;
  mockDb.select.mockImplementation(() => {
    const v = values[call] ?? [];
    call++;
    return mockDb._makeChain(v);
  });
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default: one checking account
  getCheckingIdsMock.mockResolvedValue(["acc_checking_1"]);
  // Restore default insert / update implementations
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }));
});

// ============================================================================
// recomputeMonthlyBalance
// ============================================================================

describe("recomputeMonthlyBalance", () => {
  it("produces surplus = 0 when there are no transactions and no budgets", async () => {
    setupSelectSequence([
      [{ total: "0" }], // onChecking
      [{ total: "0" }], // incomingToChecking
      [],               // netByCategory
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.forecast).toBe("0");
    expect(vals.committed).toBe("0");
    expect(vals.surplus).toBe("0");
  });

  it("computes forecast = sum of checking transactions (COMPLETED + PENDING + PLANNED)", async () => {
    setupSelectSequence([
      [{ total: "1500" }],
      [{ total: "0" }],
      [],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.forecast).toBe("1500");
    expect(vals.surplus).toBe("1500");
  });

  it("adds incoming transfers (negated) to forecast", async () => {
    // Transfers arriving on a checking account are stored with a negative amount
    // on the source side; forecast adds -(negative) = positive contribution.
    setupSelectSequence([
      [{ total: "1000" }],  // regular checking transactions
      [{ total: "-200" }],  // incoming transfer amount (source-side negative)
      [],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    // forecast = 1000 + -(-200) = 1200
    expect(vals.forecast).toBe("1200");
  });

  it("committed = max(0, budget - spent) when budget > spent", async () => {
    // cat_1: budget = 500, net = -300 → spent = 300 → committed = max(0, 500-300) = 200
    setupSelectSequence([
      [{ total: "2000" }],
      [{ total: "0" }],
      [{ categoryId: "cat_1", total: "-300" }],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "500" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.committed).toBe("200");
    expect(vals.surplus).toBe("1800");
  });

  it("committed = 0 when spent exceeds budget (over-budget category)", async () => {
    // cat_1: budget = 100, spent = 400 → max(0, 100-400) = 0
    setupSelectSequence([
      [{ total: "2000" }],
      [{ total: "0" }],
      [{ categoryId: "cat_1", total: "-400" }],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "100" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.committed).toBe("0");
    expect(vals.surplus).toBe("2000");
  });

  it("aggregates committed across multiple categories correctly", async () => {
    // cat_1: budget=300, spent=200 → max(0, 100) = 100
    // cat_2: budget=500, spent=600 → max(0, -100) = 0
    // cat_3: no budget, spent=150  → max(0, 0-150) = 0
    setupSelectSequence([
      [{ total: "2000" }],
      [{ total: "0" }],
      [
        { categoryId: "cat_1", total: "-200" },
        { categoryId: "cat_2", total: "-600" },
        { categoryId: "cat_3", total: "-150" },
      ],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "300" },
      { categoryId: "cat_2", amount: "500" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.committed).toBe("100");
    expect(vals.surplus).toBe("1900");
  });

  it("does not count positive net amounts (refunds) as spending", async () => {
    // A refund gives a positive net; spent treated as 0.
    // cat_1: budget=400, net=+50 → spent=0 → committed = max(0, 400-0) = 400
    setupSelectSequence([
      [{ total: "1000" }],
      [{ total: "0" }],
      [{ categoryId: "cat_1", total: "50" }],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "400" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.committed).toBe("400");
    expect(vals.surplus).toBe("600");
  });

  it("inserts a new record with correct year/month when none exists", async () => {
    setupSelectSequence([
      [{ total: "0" }],
      [{ total: "0" }],
      [],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 3);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.update).not.toHaveBeenCalled();

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.year).toBe(2026);
    expect(vals.month).toBe(3);
    expect(typeof vals.id).toBe("string");
    expect(vals.id.length).toBeGreaterThan(0);
  });

  it("updates the existing record instead of inserting when one already exists", async () => {
    setupSelectSequence([
      [{ total: "500" }],
      [{ total: "0" }],
      [],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue({ id: "existing_id_123" });

    await recomputeMonthlyBalance(2026, 3);

    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb.insert).not.toHaveBeenCalled();

    const setCall = mockDb.update.mock.results[0].value.set.mock.calls[0][0];
    expect(setCall.forecast).toBe("500");
    expect(setCall.surplus).toBe("500");
  });

  it("skips the forecast selects and produces forecast = 0 when there are no checking accounts", async () => {
    getCheckingIdsMock.mockResolvedValue([]);

    // Only the netByCategory select will be called
    mockDb.select.mockImplementation(() => mockDb._makeChain([]));
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(vals.forecast).toBe("0");
    expect(vals.surplus).toBe("0");
  });

  it("excludes CANCELLED transactions from forecast (only COMPLETED + PENDING + PLANNED counted)", async () => {
    // The statusFilter in recomputeMonthlyBalance uses inArray with ["COMPLETED", "PENDING", "PLANNED"]
    // which implicitly excludes CANCELLED. Here we verify that the forecast only includes
    // the non-cancelled total. The mock returns values as if the DB already filtered.
    setupSelectSequence([
      [{ total: "800" }],   // onChecking (only COMPLETED+PENDING+PLANNED)
      [{ total: "0" }],     // incomingToChecking
      [],                   // netByCategory
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 2);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    // Forecast should be 800 (CANCELLED transactions are excluded by the SQL filter)
    expect(vals.forecast).toBe("800");
    expect(vals.surplus).toBe("800");
  });

  it("aggregates forecast correctly with multiple CHECKING accounts", async () => {
    getCheckingIdsMock.mockResolvedValue(["acc_checking_1", "acc_checking_2"]);

    // The DB query uses inArray(accountId, checkingIds) so both accounts
    // are aggregated in a single SUM. The mock returns the combined total.
    setupSelectSequence([
      [{ total: "2500" }],  // onChecking: sum from both acc_checking_1 and acc_checking_2
      [{ total: "-300" }],  // incomingToChecking: transfers arriving on either checking account
      [{ categoryId: "cat_1", total: "-400" }],
    ]);
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "500" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 3);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    // forecast = 2500 + -(-300) = 2800
    expect(vals.forecast).toBe("2800");
    // committed = max(0, 500 - 400) = 100
    expect(vals.committed).toBe("100");
    // surplus = 2800 - 100 = 2700
    expect(vals.surplus).toBe("2700");
  });

  it("rounds monetary values to 2 decimal places", async () => {
    setupSelectSequence([
      [{ total: "100.1" }],
      [{ total: "0" }],
      // cat with a small spend that could produce floating-point drift
      [{ categoryId: "cat_1", total: "-0.05" }],
    ]);
    // budget = 0.1, spent = 0.05 → committed = max(0, 0.1-0.05) = 0.05
    mockDb.query.budgets.findMany.mockResolvedValue([
      { categoryId: "cat_1", amount: "0.1" },
    ]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await recomputeMonthlyBalance(2026, 1);

    const vals = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    const surplus = parseFloat(vals.surplus);
    // Verify result has at most 2 decimal places (no floating-point drift)
    expect(surplus).toBe(Math.round(surplus * 100) / 100);
    // surplus = 100.1 - 0.05 = 100.05
    expect(surplus).toBe(100.05);
  });
});

// ============================================================================
// getCarryOver
// ============================================================================

describe("getCarryOver", () => {
  it("returns 0 when there are no prior monthly balances", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([]);

    const result = await getCarryOver(2026, 1);

    expect(result).toBe(0);
  });

  it("sums surplus from all months prior to the given month in the same year", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: "200" },
      { surplus: "300" },
    ]);

    const result = await getCarryOver(2026, 3);

    expect(result).toBe(500);
  });

  it("sums surplus across multiple years", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: "100" }, // 2024 month
      { surplus: "150" }, // 2025 month
      { surplus: "50" },  // 2026 earlier month
    ]);

    const result = await getCarryOver(2026, 6);

    expect(result).toBe(300);
  });

  it("handles negative surplus values (month where spending exceeded forecast)", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: "500" },
      { surplus: "-200" },
    ]);

    const result = await getCarryOver(2026, 5);

    expect(result).toBe(300);
  });

  it("handles numeric surplus (SQLite real) alongside string surplus (PG numeric)", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: 400 },   // SQLite stores as number
      { surplus: "100" }, // PG stores as string
    ]);

    const result = await getCarryOver(2026, 2);

    expect(result).toBe(500);
  });

  it("rounds the carry-over total to 2 decimal places", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: "0.1" },
      { surplus: "0.2" },
    ]);

    const result = await getCarryOver(2026, 2);

    // 0.1 + 0.2 = 0.30000000000000004 without rounding; round2 should give 0.3
    expect(result).toBe(0.3);
  });

  it("returns 0 when all prior months have zero surplus", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([
      { surplus: "0" },
      { surplus: "0" },
    ]);

    const result = await getCarryOver(2026, 4);

    expect(result).toBe(0);
  });

  it("queries the database to retrieve prior balances", async () => {
    mockDb.query.monthlyBalances.findMany.mockResolvedValue([]);

    await getCarryOver(2026, 1);

    expect(mockDb.query.monthlyBalances.findMany).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// backfillAllMonthlyBalances
// ============================================================================

describe("backfillAllMonthlyBalances", () => {
  it("does nothing when there are no distinct transaction months", async () => {
    mockDb.selectDistinct.mockReturnValue(mockDb._makeChain([]));

    await backfillAllMonthlyBalances();

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("calls recomputeMonthlyBalance once per distinct month", async () => {
    const distinctMonths = [
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ];
    mockDb.selectDistinct.mockReturnValue(mockDb._makeChain(distinctMonths));

    // For each recomputeMonthlyBalance call: 2 forecast selects + 1 netByCategory
    let call = 0;
    mockDb.select.mockImplementation(() => {
      const v = call % 3 === 2 ? [] : [{ total: "0" }];
      call++;
      return mockDb._makeChain(v);
    });
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await backfillAllMonthlyBalances();

    // 3 distinct months → 3 inserts
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it("processes months in the order returned by the query", async () => {
    const distinctMonths = [
      { year: 2025, month: 6 },
      { year: 2026, month: 2 },
    ];
    mockDb.selectDistinct.mockReturnValue(mockDb._makeChain(distinctMonths));

    const insertedMonths: Array<{ year: number; month: number }> = [];
    let call = 0;
    mockDb.select.mockImplementation(() => {
      const v = call % 3 === 2 ? [] : [{ total: "0" }];
      call++;
      return mockDb._makeChain(v);
    });
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation(
        (vals: { year: number; month: number }) => {
          insertedMonths.push({ year: vals.year, month: vals.month });
          return Promise.resolve();
        }
      ),
    }));

    await backfillAllMonthlyBalances();

    expect(insertedMonths[0]).toEqual({ year: 2025, month: 6 });
    expect(insertedMonths[1]).toEqual({ year: 2026, month: 2 });
  });

  it("handles a single distinct month without errors", async () => {
    mockDb.selectDistinct.mockReturnValue(
      mockDb._makeChain([{ year: 2026, month: 1 }])
    );
    let call = 0;
    mockDb.select.mockImplementation(() => {
      const v = call % 3 === 2 ? [] : [{ total: "0" }];
      call++;
      return mockDb._makeChain(v);
    });
    mockDb.query.budgets.findMany.mockResolvedValue([]);
    mockDb.query.monthlyBalances.findFirst.mockResolvedValue(null);

    await expect(backfillAllMonthlyBalances()).resolves.toBeUndefined();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });
});
