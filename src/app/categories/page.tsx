export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCategories } from "./_actions/category-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryFormDialog } from "./_components/category-form-dialog";
import { SubCategoryFormDialog } from "./_components/sub-category-form-dialog";
import { DeleteCategoryButton, DeleteSubCategoryButton } from "./_components/delete-category-button";
import { DEFAULT_COLOR } from "@/lib/formatters";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catégories</h1>
          <p className="text-muted-foreground">Gérez vos catégories et sous-catégories de dépenses.</p>
        </div>
        <CategoryFormDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="relative transition-shadow transition-transform duration-200 hover:shadow-lg hover:-translate-y-0.5">
            <Link
              href={`/transactions?category=${category.id}`}
              className="absolute inset-0 z-0"
              aria-label={`Voir les transactions de ${category.name}`}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full inline-block"
                  style={{ backgroundColor: category.color ?? DEFAULT_COLOR }}
                />
                {category.name}
              </CardTitle>
              <div className="relative z-10 flex items-center gap-1">
                <CategoryFormDialog category={category} />
                <DeleteCategoryButton id={category.id} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative z-10 space-y-2">
                {category.subCategories.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between">
                    <Badge variant="secondary" className="font-normal">
                      {sub.name}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <SubCategoryFormDialog categoryId={category.id} subCategory={sub} />
                      <DeleteSubCategoryButton id={sub.id} />
                    </div>
                  </div>
                ))}
                <SubCategoryFormDialog categoryId={category.id} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
