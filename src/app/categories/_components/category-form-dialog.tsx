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
import { createCategory, updateCategory } from "../_actions/category-actions";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

type Category = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
};

export function CategoryFormDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);
  const isEdit = !!category;

  async function handleSubmit(formData: FormData) {
    const result = isEdit
      ? await updateCategory(category!.id, formData)
      : await createCategory(formData);

    if (result.error) {
      toast.error("Erreur de validation");
      return;
    }
    toast.success(isEdit ? "Catégorie modifiée" : "Catégorie créée");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle catégorie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" defaultValue={category?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Couleur</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={category?.color ?? "#6366f1"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icône</Label>
              <Input
                id="icon"
                name="icon"
                defaultValue={category?.icon ?? ""}
                placeholder="ex: ShoppingCart"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Ordre</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
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
