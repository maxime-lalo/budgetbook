import { Suspense } from "react";
import { parseMonthParam, formatCurrency } from "@/lib/formatters";
import { getBudgetsWithSpent } from "./_actions/budget-actions";
import { getTransactionTotals, getPreviousMonthBudgetRemaining } from "../transactions/_actions/transaction-actions";
import { BudgetCard } from "./_components/budget-card";
import { CopyBudgetsButton } from "./_components/copy-budgets-button";
import { MonthNavigator } from "../transactions/_components/month-navigator";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const [budgets, totals, carryOver] = await Promise.all([
    getBudgetsWithSpent(year, month),
    getTransactionTotals(year, month),
    getPreviousMonthBudgetRemaining(year, month),
  ]);

  const activeBudgets = budgets.filter((b) => b.budgeted > 0 || b.spent > 0);
  const totalBudgeted = activeBudgets.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + b.spent, 0);
  const totalCommitted = activeBudgets.reduce((sum, b) => sum + Math.max(0, b.budgeted - b.spent), 0);
  const totalRemaining = carryOver + totals.forecast - totalCommitted;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Suivez vos budgets mensuels par catégorie.</p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<Skeleton className="h-10 w-[250px]" />}>
            <MonthNavigator />
          </Suspense>
          <CopyBudgetsButton year={year} month={month} />
        </div>
      </div>

      {activeBudgets.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-muted-foreground">Total budgété</div>
                <div className="text-xl font-bold">{formatCurrency(totalBudgeted)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total dépensé</div>
                <div className="text-xl font-bold text-red-600">{formatCurrency(totalSpent)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total restant</div>
                <div className={`text-xl font-bold ${totalRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totalRemaining)}
                </div>
                {carryOver !== 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    dont report : {formatCurrency(carryOver)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            categoryId={budget.id}
            name={budget.name}
            color={budget.color}
            budgeted={budget.budgeted}
            spent={budget.spent}
            remaining={budget.remaining}
            year={year}
            month={month}
          />
        ))}
      </div>
    </div>
  );
}
