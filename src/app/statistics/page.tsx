import { Suspense } from "react";
import {
  getYearlyOverview,
  getCategoryBreakdown,
  getSubCategoryBreakdown,
  getCategoryYearComparison,
  getSavingsOverview,
  getAccounts,
  getCategoryMonthlyHeatmap,
} from "./_actions/statistics-actions";
import {
  YearlyOverviewChart,
  CategoryBreakdownChart,
  SubCategoryBreakdownChart,
  CategoryComparisonTable,
  SavingsOverviewChart,
} from "./_components/statistics-charts";
import { CategoryHeatmap } from "./_components/category-heatmap";
import { StatisticsFilters } from "./_components/statistics-filters";
import { Skeleton } from "@/components/ui/skeleton";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; account?: string }>;
}) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const accountId = params.account || undefined;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const comparisonMonth = year === currentYear ? currentMonth : 12;
  const [yearlyData, categoryData, subCategoryData, comparisonData, savingsData, accounts, heatmapData] = await Promise.all([
    getYearlyOverview(year, accountId),
    getCategoryBreakdown(year, comparisonMonth, accountId),
    getSubCategoryBreakdown(year, comparisonMonth, accountId),
    getCategoryYearComparison(year, comparisonMonth, accountId),
    getSavingsOverview(year),
    getAccounts(),
    getCategoryMonthlyHeatmap(year, accountId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-muted-foreground">Analyses et graphiques de vos finances.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-[300px]" />}>
          <StatisticsFilters
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, color: a.color, buckets: [] }))}
            currentYear={year}
            currentAccountId={accountId}
          />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <YearlyOverviewChart data={yearlyData} year={year} />
        <SavingsOverviewChart data={savingsData} year={year} />
        <CategoryBreakdownChart data={categoryData} />
        <SubCategoryBreakdownChart data={subCategoryData} />
        <CategoryComparisonTable data={comparisonData} year={year} />
        <CategoryHeatmap data={heatmapData} year={year} />
      </div>
    </div>
  );
}
