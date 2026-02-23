import { describe, it, expect } from "vitest";
import {
  transactionSchema,
  accountSchema,
  categorySchema,
  subCategorySchema,
  budgetSchema,
  bucketSchema,
  partialTransactionFieldSchema,
} from "../validators";

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

  it("validates PLANNED status", () => {
    const result = transactionSchema.safeParse({ ...validTransaction, status: "PLANNED" });
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

describe("accountSchema", () => {
  const validAccount = {
    name: "Compte courant",
    type: "CHECKING",
  };

  it("validates a correct account", () => {
    const result = accountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = accountSchema.safeParse({ ...validAccount, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = accountSchema.safeParse({ ...validAccount, type: "WALLET" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid account types", () => {
    expect(accountSchema.safeParse({ ...validAccount, type: "CHECKING" }).success).toBe(true);
    expect(accountSchema.safeParse({ ...validAccount, type: "CREDIT_CARD" }).success).toBe(true);
    expect(accountSchema.safeParse({ ...validAccount, type: "SAVINGS" }).success).toBe(true);
    expect(accountSchema.safeParse({ ...validAccount, type: "INVESTMENT" }).success).toBe(true);
  });

  it("defaults sortOrder to 0", () => {
    const result = accountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("coerces string sortOrder to number", () => {
    const result = accountSchema.safeParse({ ...validAccount, sortOrder: "3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(3);
    }
  });

  it("accepts optional nullable color and icon", () => {
    const result = accountSchema.safeParse({ ...validAccount, color: null, icon: null });
    expect(result.success).toBe(true);
  });

  it("accepts optional linkedAccountId", () => {
    const result = accountSchema.safeParse({ ...validAccount, linkedAccountId: "acc_456" });
    expect(result.success).toBe(true);
  });
});

describe("categorySchema", () => {
  const validCategory = {
    name: "Alimentation",
  };

  it("validates a correct category", () => {
    const result = categorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = categorySchema.safeParse({ ...validCategory, name: "" });
    expect(result.success).toBe(false);
  });

  it("defaults sortOrder to 0", () => {
    const result = categorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("accepts optional nullable color and icon", () => {
    const result = categorySchema.safeParse({ ...validCategory, color: "#ff0000", icon: "shopping-cart" });
    expect(result.success).toBe(true);
  });
});

describe("subCategorySchema", () => {
  const validSubCategory = {
    name: "Courses",
    categoryId: "cat_123",
  };

  it("validates a correct sub-category", () => {
    const result = subCategorySchema.safeParse(validSubCategory);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = subCategorySchema.safeParse({ ...validSubCategory, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing categoryId", () => {
    const result = subCategorySchema.safeParse({ ...validSubCategory, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("defaults sortOrder to 0", () => {
    const result = subCategorySchema.safeParse(validSubCategory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("coerces string sortOrder to number", () => {
    const result = subCategorySchema.safeParse({ ...validSubCategory, sortOrder: "2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(2);
    }
  });
});

describe("budgetSchema", () => {
  const validBudget = {
    categoryId: "cat_123",
    month: 6,
    year: 2026,
    amount: 300,
  };

  it("validates a correct budget", () => {
    const result = budgetSchema.safeParse(validBudget);
    expect(result.success).toBe(true);
  });

  it("rejects month below 1", () => {
    const result = budgetSchema.safeParse({ ...validBudget, month: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects month above 12", () => {
    const result = budgetSchema.safeParse({ ...validBudget, month: 13 });
    expect(result.success).toBe(false);
  });

  it("accepts boundary months 1 and 12", () => {
    expect(budgetSchema.safeParse({ ...validBudget, month: 1 }).success).toBe(true);
    expect(budgetSchema.safeParse({ ...validBudget, month: 12 }).success).toBe(true);
  });

  it("rejects year below 2000", () => {
    const result = budgetSchema.safeParse({ ...validBudget, year: 1999 });
    expect(result.success).toBe(false);
  });

  it("rejects year above 2100", () => {
    const result = budgetSchema.safeParse({ ...validBudget, year: 2101 });
    expect(result.success).toBe(false);
  });

  it("accepts boundary years 2000 and 2100", () => {
    expect(budgetSchema.safeParse({ ...validBudget, year: 2000 }).success).toBe(true);
    expect(budgetSchema.safeParse({ ...validBudget, year: 2100 }).success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = budgetSchema.safeParse({ ...validBudget, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("accepts zero amount", () => {
    const result = budgetSchema.safeParse({ ...validBudget, amount: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects missing categoryId", () => {
    const result = budgetSchema.safeParse({ ...validBudget, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("coerces string amount to number", () => {
    const result = budgetSchema.safeParse({ ...validBudget, amount: "150" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(150);
    }
  });
});

describe("bucketSchema", () => {
  const validBucket = {
    name: "Épargne vacances",
    accountId: "acc_123",
  };

  it("validates a correct bucket", () => {
    const result = bucketSchema.safeParse(validBucket);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = bucketSchema.safeParse({ ...validBucket, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing accountId", () => {
    const result = bucketSchema.safeParse({ ...validBucket, accountId: "" });
    expect(result.success).toBe(false);
  });

  it("preprocesses empty string goal to null", () => {
    const result = bucketSchema.safeParse({ ...validBucket, goal: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBeNull();
    }
  });

  it("preprocesses undefined goal to null", () => {
    const result = bucketSchema.safeParse({ ...validBucket, goal: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBeNull();
    }
  });

  it("coerces string goal to number", () => {
    const result = bucketSchema.safeParse({ ...validBucket, goal: "500" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBe(500);
    }
  });

  it("accepts a numeric goal", () => {
    const result = bucketSchema.safeParse({ ...validBucket, goal: 1000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBe(1000);
    }
  });

  it("rejects negative goal", () => {
    const result = bucketSchema.safeParse({ ...validBucket, goal: -100 });
    expect(result.success).toBe(false);
  });

  it("preprocesses empty string baseAmount to 0", () => {
    const result = bucketSchema.safeParse({ ...validBucket, baseAmount: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseAmount).toBe(0);
    }
  });

  it("defaults sortOrder to 0", () => {
    const result = bucketSchema.safeParse(validBucket);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("accepts optional nullable color", () => {
    const result = bucketSchema.safeParse({ ...validBucket, color: "#00ff00" });
    expect(result.success).toBe(true);
  });
});

describe("partialTransactionFieldSchema", () => {
  it("validates an empty object (all fields optional)", () => {
    const result = partialTransactionFieldSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates a partial label update", () => {
    const result = partialTransactionFieldSchema.safeParse({ label: "Nouveau libellé" });
    expect(result.success).toBe(true);
  });

  it("rejects empty label", () => {
    const result = partialTransactionFieldSchema.safeParse({ label: "" });
    expect(result.success).toBe(false);
  });

  it("validates a numeric amount update", () => {
    const result = partialTransactionFieldSchema.safeParse({ amount: -75.5 });
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = partialTransactionFieldSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it("validates a valid month update", () => {
    const result = partialTransactionFieldSchema.safeParse({ month: 6 });
    expect(result.success).toBe(true);
  });

  it("rejects month out of range", () => {
    expect(partialTransactionFieldSchema.safeParse({ month: 0 }).success).toBe(false);
    expect(partialTransactionFieldSchema.safeParse({ month: 13 }).success).toBe(false);
  });

  it("validates a valid year update", () => {
    const result = partialTransactionFieldSchema.safeParse({ year: 2026 });
    expect(result.success).toBe(true);
  });

  it("rejects year out of range", () => {
    expect(partialTransactionFieldSchema.safeParse({ year: 1999 }).success).toBe(false);
    expect(partialTransactionFieldSchema.safeParse({ year: 2101 }).success).toBe(false);
  });

  it("validates a valid status update", () => {
    expect(partialTransactionFieldSchema.safeParse({ status: "PENDING" }).success).toBe(true);
    expect(partialTransactionFieldSchema.safeParse({ status: "COMPLETED" }).success).toBe(true);
    expect(partialTransactionFieldSchema.safeParse({ status: "CANCELLED" }).success).toBe(true);
    expect(partialTransactionFieldSchema.safeParse({ status: "PLANNED" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = partialTransactionFieldSchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("validates nullable categoryId", () => {
    const result = partialTransactionFieldSchema.safeParse({ categoryId: null });
    expect(result.success).toBe(true);
  });

  it("validates nullable date", () => {
    const result = partialTransactionFieldSchema.safeParse({ date: null });
    expect(result.success).toBe(true);
  });

  it("validates boolean isAmex and recurring fields", () => {
    const result = partialTransactionFieldSchema.safeParse({ isAmex: true, recurring: false });
    expect(result.success).toBe(true);
  });

  it("validates nullable destinationAccountId", () => {
    const result = partialTransactionFieldSchema.safeParse({ destinationAccountId: null });
    expect(result.success).toBe(true);
  });
});
