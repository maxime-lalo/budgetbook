"use client";

import { Button } from "@/components/ui/button";
import { Scale } from "lucide-react";
import { calibrateBudgets } from "../_actions/budget-actions";
import { toast } from "sonner";

export function CalibrateBudgetsButton({
  year,
  month,
  hasOverBudget,
}: {
  year: number;
  month: number;
  hasOverBudget: boolean;
}) {
  if (!hasOverBudget) return null;

  async function handleCalibrate() {
    const result = await calibrateBudgets(year, month);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} budget${result.count > 1 ? "s" : ""} calibré${result.count > 1 ? "s" : ""}`);
  }

  return (
    <Button variant="outline" onClick={handleCalibrate}>
      <Scale className="h-4 w-4 mr-2" />
      Calibrer les budgets
    </Button>
  );
}
