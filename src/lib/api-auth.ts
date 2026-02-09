import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function validateApiToken(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice(7);
  if (!token) return false;

  const found = await prisma.apiToken.findUnique({ where: { token } });
  return !!found;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
