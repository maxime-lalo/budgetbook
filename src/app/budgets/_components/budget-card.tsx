"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { upsertBudget } from "../_actions/budget-actions";
import { toast } from "sonner";

type BudgetCardProps = {
  categoryId: string;
  name: string;
  color: string | null;
  budgeted: number;
  spent: number;
  remaining: number;
  year: number;
  month: number;
};

function isOverBudget(spent: number, budgeted: number): boolean {
  return spent > budgeted && spent > 0;
}

function getStatusColor(spent: number, budgeted: number): string {
  if (budgeted === 0 && spent === 0) return "text-muted-foreground";
  if (isOverBudget(spent, budgeted)) return "text-red-600";
  const ratio = spent / budgeted;
  if (ratio >= 0.75) return "text-yellow-600";
  return "text-green-600";
}

function getProgressColor(spent: number, budgeted: number): string {
  if (budgeted === 0 && spent === 0) return "";
  if (isOverBudget(spent, budgeted)) return "[&>div]:bg-red-500";
  if (budgeted === 0) return "";
  const ratio = spent / budgeted;
  if (ratio >= 0.75) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}

export function BudgetCard({
  categoryId,
  name,
  color,
  budgeted,
  spent,
  remaining,
  year,
  month,
}: BudgetCardProps) {
  const router = useRouter();
  const [value, setValue] = useState(budgeted.toString());

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

  const overBudget = isOverBudget(spent, budgeted);
  const progress = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : (spent > 0 ? 100 : 0);

  return (
    <Card
      className={`relative cursor-pointer transition-shadow transition-transform duration-200 hover:shadow-lg hover:-translate-y-0.5 ${overBudget ? "border-red-500 border-2" : ""}`}
      onClick={() => router.push(`/transactions?category=${categoryId}`)}
    >
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color ?? "#6b7280" }}
            />
            <span className="font-medium text-sm">{name}</span>
          </div>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={(e) => e.stopPropagation()}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleBlur}
              className="h-7 w-24 text-right text-sm border-transparent bg-transparent hover:border-input focus:border-input font-medium"
            />
          </div>
        </div>

        <Progress value={progress} className={`h-2 ${getProgressColor(spent, budgeted)}`} />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Dépensé: <span className="font-medium text-foreground">{formatCurrency(spent)}</span>
          </span>
          <span className={getStatusColor(spent, budgeted)}>
            Reste: {formatCurrency(remaining)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
