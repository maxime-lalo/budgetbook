import { Suspense } from "react";
import { parseMonthParam } from "@/lib/formatters";
import { getTransactions, getTransactionTotals, getFormData, getPreviousMonthBudgetRemaining } from "./_actions/transaction-actions";
import { MonthNavigator } from "./_components/month-navigator";
import { TotalsBar } from "./_components/totals-bar";
import { TransactionsTable } from "./_components/transactions-table";
import { TransactionFormDialog } from "./_components/transaction-form-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const [transactions, totals, formData, budgetCarryOver] = await Promise.all([
    getTransactions(year, month),
    getTransactionTotals(year, month),
    getFormData(),
    getPreviousMonthBudgetRemaining(year, month),
  ]);

  const amexAccountIds = new Set(
    formData.accounts.filter((a) => a.type === "CREDIT_CARD").map((a) => a.id)
  );
  const amexPendingCount = transactions.filter(
    (t) => t.status === "PENDING" && amexAccountIds.has(t.accountId)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Vue mensuelle de toutes vos transactions.</p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<Skeleton className="h-10 w-[250px]" />}>
            <MonthNavigator />
          </Suspense>
          <TransactionFormDialog
            accounts={formData.accounts}
            categories={formData.categories}
            year={year}
            month={month}
          />
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
      />
    </div>
  );
}
