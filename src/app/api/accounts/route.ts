import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  if (!(await validateApiToken(request))) return unauthorizedResponse();

  const accounts = await prisma.account.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, type: true },
  });

  return NextResponse.json(accounts);
}
