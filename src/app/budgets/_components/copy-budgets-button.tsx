"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { copyBudgetsFromPreviousMonth } from "../_actions/budget-actions";
import { toast } from "sonner";

export function CopyBudgetsButton({ year, month }: { year: number; month: number }) {
  async function handleCopy() {
    const result = await copyBudgetsFromPreviousMonth(year, month);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} budgets copiés du mois précédent`);
  }

  return (
    <Button variant="outline" onClick={handleCopy}>
      <Copy className="h-4 w-4 mr-2" />
      Copier du mois précédent
    </Button>
  );
}
