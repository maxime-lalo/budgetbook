import { parseMonthParam, formatMonthYear } from "@/lib/formatters";
import { getDashboardData } from "./_actions/dashboard-actions";
import { SummaryCards, AccountsList, BudgetAlerts, RecentTransactions, RecentTransfers } from "./_components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = parseMonthParam();
  const data = await getDashboardData(year, month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground capitalize">
          {formatMonthYear(new Date(year, month - 1))}
        </p>
      </div>

      <SummaryCards
        totals={data.totals}
        income={data.income}
        expenses={data.expenses}
        carryOver={data.carryOver}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AccountsList accounts={data.accounts} />
        <BudgetAlerts overBudgetCategories={data.overBudgetCategories} />
        <RecentTransactions recentTransactions={data.recentTransactions} />
        <RecentTransfers recentTransfers={data.recentTransfers} />
      </div>
    </div>
  );
}
