"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteCategory, deleteSubCategory } from "../_actions/category-actions";
import { toast } from "sonner";

export function DeleteCategoryButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm("Supprimer cette catégorie et toutes ses sous-catégories ?")) return;
    await deleteCategory(id);
    toast.success("Catégorie supprimée");
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function DeleteSubCategoryButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm("Supprimer cette sous-catégorie ?")) return;
    await deleteSubCategory(id);
    toast.success("Sous-catégorie supprimée");
  }

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete}>
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
