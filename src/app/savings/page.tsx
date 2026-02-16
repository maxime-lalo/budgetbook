import { Suspense } from "react";
import { getSavingsTransactions, getSavingsTotals } from "./_actions/savings-actions";
import { getFormData } from "@/app/transactions/_actions/transaction-actions";
import { YearNavigator } from "./_components/year-navigator";
import { TotalsBar } from "@/app/transactions/_components/totals-bar";
import { TransactionsTable } from "@/app/transactions/_components/transactions-table";
import { TransactionFormDialog } from "@/app/transactions/_components/transaction-form-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function SavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = now.getMonth() + 1;

  const [transactions, totals, formData] = await Promise.all([
    getSavingsTransactions(year),
    getSavingsTotals(year),
    getFormData(),
  ]);

  const defaultAccountId = formData.accounts.find((a) => a.type === "SAVINGS")?.id;
  const defaultCategoryId = formData.categories.find((c) => c.name.toLowerCase() === "economies")?.id;

  return (
    <div className="space-y-2 sm:space-y-6 pb-20 sm:pb-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Économies</h1>
          <p className="text-muted-foreground">Transactions annuelles des comptes épargne et investissement.</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4">
          <TransactionFormDialog
            accounts={formData.accounts}
            categories={formData.categories}
            year={year}
            month={month}
            amexEnabled={false}
          />
          <Suspense fallback={<Skeleton className="h-10 w-[250px]" />}>
            <YearNavigator />
          </Suspense>
        </div>
      </div>

      <TotalsBar {...totals} budgetCarryOver={0} />

      <TransactionsTable
        transactions={transactions}
        accounts={formData.accounts}
        categories={formData.categories}
        budgetCarryOver={0}
        year={year}
        month={month}
        amexPendingCount={0}
        amexMonthlyTotal={0}
        amexEnabled={false}
        hideCopyRecurring
        flatLayout
        defaultAccountId={defaultAccountId}
        defaultCategoryId={defaultCategoryId}
      />
    </div>
  );
}
