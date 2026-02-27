import { NextResponse } from "next/server";
import { db, categories } from "@/lib/db";
import { eq } from "drizzle-orm";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  const userId = await validateApiToken(request);
  if (!userId) return unauthorizedResponse();

  const result = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
    with: {
      subCategories: {
        columns: { id: true, name: true },
      },
    },
  });

  const sorted = result
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr"))
    .map((c: { id: string; name: string; color: string | null; subCategories: { id: string; name: string }[] }) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      subCategories: c.subCategories.sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, "fr")
      ),
    }));

  return NextResponse.json(sorted);
}
