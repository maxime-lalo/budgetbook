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
import { CreditCard } from "lucide-react";
import { completeAmexTransactions } from "../_actions/transaction-actions";
import { toast } from "sonner";

export function CompleteAmexButton({
  year,
  month,
  pendingCount,
}: {
  year: number;
  month: number;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await completeAmexTransactions(year, month);
    toast.success(`${result.count} transaction(s) AMEX passée(s) en réalisé`);
    setOpen(false);
  }

  if (pendingCount === 0) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CreditCard className="h-4 w-4 mr-2" />
        Valider AMEX ({pendingCount})
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider les transactions AMEX ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCount} transaction(s) AMEX en attente seront passées en
              réalisé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
