import { NextResponse } from "next/server";
import { db, accounts } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  const userId = await validateApiToken(request);
  if (!userId) return unauthorizedResponse();

  const result = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.sortOrder));

  return NextResponse.json(result);
}
