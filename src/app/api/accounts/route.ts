import { NextResponse } from "next/server";
import { db, accounts } from "@/lib/db";
import { asc } from "drizzle-orm";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  if (!(await validateApiToken(request))) return unauthorizedResponse();

  const result = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type })
    .from(accounts)
    .orderBy(asc(accounts.sortOrder));

  return NextResponse.json(result);
}
