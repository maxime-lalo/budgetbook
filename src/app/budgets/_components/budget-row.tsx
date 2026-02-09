"use client";

import { useState, useEffect } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { ProgressBar } from "@/components/ui/progress-bar";
import { upsertBudget } from "../_actions/budget-actions";
import { toast } from "sonner";

function ProgressPercent({ value, max, variant }: { value: number; max: number; variant: "budget" | "goal" }) {
  const ratio = max > 0 ? value / max : value > 0 ? 1 : 0;
  const percent = Math.round(Math.min(ratio * 100, 999));

  let colorClass: string;
  if (variant === "budget") {
    if (max === 0 && value === 0) colorClass = "text-muted-foreground";
    else if (ratio >= 1) colorClass = "text-red-500";
    else if (ratio >= 0.75) colorClass = "text-yellow-500";
    else colorClass = "text-green-500";
  } else {
    if (ratio >= 0.75) colorClass = "text-green-500";
    else if (ratio >= 0.5) colorClass = "text-yellow-500";
    else colorClass = "text-red-500";
  }

  return <span className={`text-sm font-medium ${colorClass}`}>{percent}%</span>;
}

type BudgetRowProps = {
  categoryId: string;
  name: string;
  color: string | null;
  budgeted: number;
  spent: number;
  remaining: number;
  year: number;
  month: number;
};

export function BudgetRow({
  categoryId,
  name,
  color,
  budgeted,
  spent,
  remaining,
  year,
  month,
}: BudgetRowProps) {
  const [value, setValue] = useState(budgeted.toString());

  useEffect(() => {
    setValue(budgeted.toString());
  }, [budgeted]);

  async function handleBlur() {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) {
      setValue(budgeted.toString());
      return;
    }
    if (amount === budgeted) return;
    await upsertBudget(categoryId, year, month, amount);
    toast.success("Budget mis à jour");
  }

  const overBudget = spent > budgeted && spent > 0;

  return (
    <TableRow className={overBudget ? "bg-red-500/10 border-2 border-red-500" : ""}>
      <TableCell className="py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color ?? "#6b7280" }}
          />
          <span className="font-medium text-sm">{name}</span>
        </div>
      </TableCell>
      <TableCell className="py-2 hidden sm:table-cell min-w-[200px]">
        <ProgressBar value={spent} max={budgeted} variant="budget" />
      </TableCell>
      <TableCell className="py-2 sm:hidden text-center">
        <ProgressPercent value={spent} max={budgeted} variant="budget" />
      </TableCell>
      <TableCell className="py-2 text-center">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          className="h-7 w-24 text-center text-sm border-transparent bg-transparent hover:border-input focus:border-input font-medium mx-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </TableCell>
      <TableCell className="py-2 text-sm text-center">
        {spent === 0 ? "–" : formatCurrency(spent)}
      </TableCell>
      <TableCell className={`py-2 text-sm text-center font-medium ${remaining === 0 ? "" : remaining > 0 ? "text-green-600" : "text-red-600"}`}>
        {remaining === 0 ? "–" : formatCurrency(remaining)}
      </TableCell>
    </TableRow>
  );
}
