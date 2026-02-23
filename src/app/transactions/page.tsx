import { Suspense } from "react";
import Link from "next/link";
import { parseMonthParam, toMonthParam } from "@/lib/formatters";
import { getTransactions, getTransactionTotals, getFormData, getPreviousMonthBudgetRemaining } from "./_actions/transaction-actions";
import { getAppPreferences } from "@/app/settings/_actions/settings-actions";
import { MonthNavigator } from "./_components/month-navigator";
import { TotalsBar } from "./_components/totals-bar";
import { TransactionsTable } from "./_components/transactions-table";
import { TransactionFormDialog } from "./_components/transaction-form-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const [transactions, totals, formData, budgetCarryOver, prefs] = await Promise.all([
    getTransactions(year, month),
    getTransactionTotals(year, month),
    getFormData(),
    getPreviousMonthBudgetRemaining(year, month),
    getAppPreferences(),
  ]);

  const amexEnabled = prefs.amexEnabled;

  const amexPendingCount = amexEnabled
    ? transactions.filter((t) => t.isAmex && t.status === "PENDING").length
    : 0;
  const amexMonthlyTotal = amexEnabled
    ? transactions
        .filter((t) => t.isAmex && t.status !== "CANCELLED")
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  return (
    <div className="space-y-2 sm:space-y-6 pb-20 sm:pb-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Vue mensuelle de toutes vos transactions.</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4">
          <TransactionFormDialog
            accounts={formData.accounts}
            categories={formData.categories}
            year={year}
            month={month}
            amexEnabled={amexEnabled}
          />
          <Button variant="outline" size="icon" asChild>
            <Link href={`/transactions/print?month=${toMonthParam(year, month)}`} target="_blank" title="Imprimer">
              <Printer className="h-4 w-4" />
            </Link>
          </Button>
          <Suspense fallback={<Skeleton className="h-10 w-[250px]" />}>
            <MonthNavigator />
          </Suspense>
        </div>
      </div>

      <TotalsBar {...totals} budgetCarryOver={budgetCarryOver} />

      <TransactionsTable
        transactions={transactions}
        accounts={formData.accounts}
        categories={formData.categories}
        budgetCarryOver={budgetCarryOver}
        initialCategory={params.category}
        year={year}
        month={month}
        amexPendingCount={amexPendingCount}
        amexMonthlyTotal={amexMonthlyTotal}
        amexEnabled={amexEnabled}
        separateRecurring={prefs.separateRecurring}
      />
    </div>
  );
}
