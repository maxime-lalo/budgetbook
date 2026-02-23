"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, DEFAULT_COLOR } from "@/lib/formatters";

type YearlyData = {
  month: number;
  monthLabel: string;
  income: number;
  expenses: number;
}[];

type CategoryData = {
  category: string;
  color: string;
  amount: number;
}[];

type SubCategoryData = {
  items: {
    categoryId: string;
    subCategory: string;
    color: string;
    amount: number;
  }[];
  categories: { id: string; name: string; color: string | null }[];
};

type CategoryComparisonRow = {
  category: string;
  color: string;
  currentMonth: number;
  currentAvg: number;
  yearlyTotal: number;
  percentOfMonthTotal: number;
  percentOfYearTotal: number;
  prevYearAvg: number;
  diffPercent: number;
};

type CategoryComparisonData = {
  rows: CategoryComparisonRow[];
  totals: { currentMonth: number; yearlyTotal: number; prevYearTotal: number };
  month: number;
};

const tooltipFormatter = (value: number) => formatCurrency(value);

export function YearlyOverviewChart({ data, year }: { data: YearlyData; year: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vue annuelle {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthLabel" type="category" interval={0} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              name="Revenus"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Dépenses"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CategoryBreakdownChart({ data }: { data: CategoryData }) {
  const expenses = data.filter((d) => d.amount > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, expenses.length * 40)}>
          <BarChart data={expenses} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="category" width={120} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="amount" name="Dépensé" radius={[0, 4, 4, 0]}>
              {expenses.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SubCategoryBreakdownChart({ data }: { data: SubCategoryData }) {
  const { items, categories } = data;
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");

  if (categories.length === 0) return null;

  const filtered = items.filter((i) => i.categoryId === selectedCategoryId);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Répartition par sous-catégorie</CardTitle>
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color ?? DEFAULT_COLOR }}
                  />
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucune sous-catégorie pour cette catégorie.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, filtered.length * 40)}>
            <BarChart data={filtered} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="subCategory" width={160} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="amount" name="Dépensé" radius={[0, 4, 4, 0]}>
                {filtered.map((_, index) => (
                  <Cell key={index} fill={selectedCategory?.color ?? DEFAULT_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryComparisonTable({ data, year }: { data: CategoryComparisonData; year: number }) {
  const { rows, totals } = data;
  const isCurrentYear = year === new Date().getFullYear();

  function formatPct(v: number) {
    return v.toFixed(2) + "%";
  }

  function diffColor(v: number) {
    if (v > 5) return "text-red-500";
    if (v < -5) return "text-green-500";
    return "text-muted-foreground";
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Comparaison par catégorie {year} vs {year - 1}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Catégorie</th>
                {isCurrentYear && <th className="text-right py-2 px-3 font-medium">Cumul jan.-{new Date().toLocaleDateString("fr-FR", { month: "short" })}</th>}
                {isCurrentYear && <th className="text-right py-2 px-3 font-medium">Moy. jan.-{new Date().toLocaleDateString("fr-FR", { month: "short" })}</th>}
                <th className="text-right py-2 px-3 font-medium">Moy. mens.</th>
                {!isCurrentYear && <th className="text-right py-2 px-3 font-medium">Total annuel</th>}
                {isCurrentYear && <th className="text-right py-2 px-3 font-medium">% mois</th>}
                <th className="text-right py-2 px-3 font-medium">% annuel</th>
                <th className="text-right py-2 px-3 font-medium">Moy. {year - 1}</th>
                <th className="text-right py-2 pl-3 font-medium">Diff {year - 1}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.category}
                    </div>
                  </td>
                  {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(row.yearlyTotal)}</td>}
                  {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(row.yearlyTotal / data.month)}</td>}
                  <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(row.currentAvg)}</td>
                  {!isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(row.yearlyTotal)}</td>}
                  {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">{formatPct(row.percentOfMonthTotal)}</td>}
                  <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">{formatPct(row.percentOfYearTotal)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(row.prevYearAvg)}</td>
                  <td className={`text-right py-2 pl-3 tabular-nums font-semibold ${diffColor(row.diffPercent)}`}>
                    {row.prevYearAvg === 0 && row.currentAvg === 0
                      ? "—"
                      : (row.diffPercent > 0 ? "+" : "") + formatPct(row.diffPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-4">Total</td>
                {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(totals.yearlyTotal)}</td>}
                {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(totals.yearlyTotal / data.month)}</td>}
                <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(totals.yearlyTotal / 12)}</td>
                {!isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(totals.yearlyTotal)}</td>}
                {isCurrentYear && <td className="text-right py-2 px-3 tabular-nums">100%</td>}
                <td className="text-right py-2 px-3 tabular-nums">100%</td>
                <td className="text-right py-2 px-3 tabular-nums">{formatCurrency(totals.prevYearTotal / 12)}</td>
                <td className="text-right py-2 pl-3 tabular-nums">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

type SavingsData = {
  month: number;
  monthLabel: string;
  total: number;
}[];

export function SavingsOverviewChart({ data, year }: { data: SavingsData; year: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Épargne {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthLabel" type="category" interval={0} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={tooltipFormatter} />
            <Area
              type="monotone"
              dataKey="total"
              name="Épargne totale"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
