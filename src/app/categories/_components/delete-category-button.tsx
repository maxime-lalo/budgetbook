"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { deleteCategory, deleteSubCategory, getCategoryUsageCount } from "../_actions/category-actions";
import { toast } from "sonner";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const count = await getCategoryUsageCount(id);
    setUsageCount(count);
    setLoading(false);
    setOpen(true);
  }

  async function handleConfirm() {
    await deleteCategory(id);
    setOpen(false);
    toast.success("Catégorie supprimée");
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handleClick} disabled={loading} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              {usageCount > 0 ? (
                <>
                  <strong>{usageCount} transaction{usageCount > 1 ? "s" : ""}</strong> {usageCount > 1 ? "utilisent" : "utilise"} cette catégorie et {usageCount > 1 ? "perdront" : "perdra"} leur catégorie.
                  Les sous-catégories et budgets associés seront également supprimés.
                </>
              ) : (
                "Les sous-catégories et budgets associés seront également supprimés."
              )}
              <br /><br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
