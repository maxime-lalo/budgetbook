"use server";

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function getApiToken() {
  const token = await prisma.apiToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!token) return null;

  return {
    token: token.token,
    createdAt: token.createdAt.toISOString(),
  };
}

export async function regenerateApiToken() {
  await prisma.apiToken.deleteMany();

  const newToken = await prisma.apiToken.create({
    data: {
      token: randomUUID(),
    },
  });

  return {
    token: newToken.token,
    createdAt: newToken.createdAt.toISOString(),
  };
}
