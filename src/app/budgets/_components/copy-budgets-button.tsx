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
import { Copy } from "lucide-react";
import { copyBudgetsFromPreviousMonth } from "../_actions/budget-actions";
import { toast } from "sonner";

export function CopyBudgetsButton({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await copyBudgetsFromPreviousMonth(year, month);
    setOpen(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} budgets copiés du mois précédent`);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Copy className="h-4 w-4 mr-2" />
        <span className="sm:hidden">Copier M-1</span>
        <span className="hidden sm:inline">Copier du mois précédent</span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copier les budgets du mois précédent ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va écraser les budgets existants du mois en cours avec ceux du mois précédent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
