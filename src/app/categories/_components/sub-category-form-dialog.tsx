"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubCategory, updateSubCategory } from "../_actions/category-actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

type SubCategory = {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
};

export function SubCategoryFormDialog({
  categoryId,
  subCategory,
}: {
  categoryId: string;
  subCategory?: SubCategory;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!subCategory;

  async function handleSubmit(formData: FormData) {
    formData.set("categoryId", categoryId);
    const result = isEdit
      ? await updateSubCategory(subCategory!.id, formData)
      : await createSubCategory(formData);

    if (result.error) {
      toast.error("Erreur de validation");
      return;
    }
    toast.success(isEdit ? "Sous-catégorie modifiée" : "Sous-catégorie créée");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm">
            <Plus className="h-3 w-3 mr-1" />
            Sous-catégorie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la sous-catégorie" : "Nouvelle sous-catégorie"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Nom</Label>
            <Input id="sub-name" name="name" defaultValue={subCategory?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-sortOrder">Ordre</Label>
            <Input
              id="sub-sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={subCategory?.sortOrder ?? 0}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">{isEdit ? "Modifier" : "Créer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
