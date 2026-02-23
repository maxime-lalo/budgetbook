import { NextResponse } from "next/server";
import { db, apiTokens } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function validateApiToken(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice(7);
  if (!token) return false;

  const hashed = hashToken(token);
  const found = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.token, hashed),
  });
  return !!found;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
