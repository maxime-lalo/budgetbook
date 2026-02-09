import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  if (!(await validateApiToken(request))) return unauthorizedResponse();

  const categories = await prisma.category.findMany({
    include: {
      subCategories: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  const sorted = categories
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      subCategories: c.subCategories.sort((a, b) =>
        a.name.localeCompare(b.name, "fr")
      ),
    }));

  return NextResponse.json(sorted);
}
