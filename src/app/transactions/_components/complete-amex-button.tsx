"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
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
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await completeAmexTransactions(year, month);
    toast.success(`${result.count} transaction(s) AMEX passée(s) en réalisé`);
    window.location.reload();
  }

  if (pendingCount === 0) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
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
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? "Validation..." : "Confirmer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
