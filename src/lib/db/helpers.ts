/** Round a number to 2 decimal places (avoids floating-point comparison issues on monetary values) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a DB value (string from PG numeric, or number from SQLite real) to number */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value);
}

/** Convert a number to a string for PG numeric columns, or pass through for SQLite */
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
  // SQLite stores dates as strings — parse then format
  return new Date(value).toISOString();
}

/**
 * Convert a Date/string to the format expected by the active DB provider.
 * PG timestamp columns expect Date objects; SQLite text columns expect strings.
 * The return type is `Date` to satisfy PgDb typing, but at runtime it may be a string.
 */
export function toDbTimestamp(value: Date | string): Date {
  const provider = process.env.DB_PROVIDER ?? "postgresql";
  if (provider === "sqlite") {
    const s = value instanceof Date ? value.toISOString() : value;
    return s as unknown as Date;
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Convert a Date/string to the format expected for a date column (no time).
 * PG date columns expect Date objects; SQLite text columns expect "YYYY-MM-DD" strings.
 */
export function toDbDate(value: Date | string): Date {
  const provider = process.env.DB_PROVIDER ?? "postgresql";
  if (provider === "sqlite") {
    const d = value instanceof Date ? value : new Date(value);
    const s = d.toISOString().split("T")[0];
    return s as unknown as Date;
  }
  return value instanceof Date ? value : new Date(value);
}
