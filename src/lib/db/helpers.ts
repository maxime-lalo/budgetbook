import { eq, and } from "drizzle-orm";

/** Round a number to 2 decimal places (avoids floating-point comparison issues on monetary values) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a DB value (string from PG numeric) to number */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value);
}

/** Convert a number to a string for PG numeric columns */
export function toDecimal(value: number): string {
  return value.toString();
}

/** Convert a DB date value to a Date object */
export function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}

/** Convert a DB date value to an ISO string */
export function toISOString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

/** Convert a Date/string to a Date object for PG timestamp columns */
export function toDbTimestamp(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Convert a Date/string to a Date object for PG date columns (no time) */
export function toDbDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Get all CHECKING account IDs for a given user */
export async function getCheckingAccountIds(userId: string): Promise<string[]> {
  const { db, accounts } = await import("@/lib/db");
  const result = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.type, "CHECKING"), eq(accounts.userId, userId)));
  return result.map((a) => a.id);
}
