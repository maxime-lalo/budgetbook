"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { copyRecurringTransactions } from "../_actions/transaction-actions";
import { toast } from "sonner";

export function CopyRecurringButton({ year, month }: { year: number; month: number }) {
  async function handleCopy() {
    const result = await copyRecurringTransactions(year, month);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} transactions récurrentes copiées du mois précédent`);
  }

  return (
    <Button variant="outline" onClick={handleCopy}>
      <Copy className="h-4 w-4 mr-2" />
      Copier récurrentes
    </Button>
  );
}
