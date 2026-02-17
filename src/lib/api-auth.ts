import { NextResponse } from "next/server";
import { db, apiTokens } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function validateApiToken(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice(7);
  if (!token) return false;

  const found = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.token, token),
  });
  return !!found;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
