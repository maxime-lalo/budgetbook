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
import { copyRecurringTransactions } from "../_actions/transaction-actions";
import { toast } from "sonner";

export function CopyRecurringButton({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await copyRecurringTransactions(year, month);
    setOpen(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} transactions récurrentes copiées du mois précédent`);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        <Copy className="h-4 w-4 mr-2" />
        Copier récurrentes
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copier les transactions récurrentes ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer toutes les transactions récurrentes du mois en cours et les remplacer par celles du mois précédent.
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
