"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, AlertTriangle, ArrowRight } from "lucide-react";

type DashboardData = {
  totals: { real: number; pending: number; forecast: number };
  income: number;
  expenses: number;
  carryOver: number;
  accounts: { id: string; name: string; type: string; color: string | null; balance: number }[];
  overBudgetCategories: { id: string; name: string; color: string | null; budgeted: number; spent: number; remaining: number }[];
  recentTransactions: { id: string; label: string; amount: number; date: string | null; status: string; category: { name: string; color: string | null }; account: { name: string; color: string | null } }[];
  recentTransfers: { id: string; label: string; amount: number; date: string | null; status: string; account: { name: string; color: string | null }; destinationAccount: { name: string; color: string | null } | null }[];
};

export function SummaryCards({ totals, income, expenses, carryOver }: Pick<DashboardData, "totals" | "income" | "expenses" | "carryOver">) {
  const resteAVivre = totals.forecast + carryOver;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card className="py-3">
        <CardContent className="px-4 py-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Reste à vivre</div>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className={`text-2xl font-bold ${resteAVivre >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(resteAVivre)}
          </div>
          {carryOver !== 0 && (
            <div className="text-xs text-muted-foreground">
              dont report : {formatCurrency(carryOver)}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardContent className="px-4 py-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Dépenses</div>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(expenses)}
          </div>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardContent className="px-4 py-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Revenus</div>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(income)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountsList({ accounts }: Pick<DashboardData, "accounts">) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Comptes</CardTitle>
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Voir tout <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: account.color ?? "#6b7280" }}
                />
                <span className="text-sm">{account.name}</span>
              </div>
              <span className={`text-sm font-medium tabular-nums ${account.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun compte configuré.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BudgetAlerts({ overBudgetCategories }: Pick<DashboardData, "overBudgetCategories">) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Dépassements
          </CardTitle>
          <Link href="/budgets" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Voir tout <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {overBudgetCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dépassement de budget.</p>
        ) : (
          <div className="space-y-3">
            {overBudgetCategories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color ?? "#6b7280" }}
                    />
                    <span>{cat.name}</span>
                  </div>
                  <span className="text-red-600 font-medium tabular-nums">
                    {formatCurrency(cat.remaining)}
                  </span>
                </div>
                <ProgressBar value={cat.spent} max={cat.budgeted} variant="budget" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentTransactions({ recentTransactions }: Pick<DashboardData, "recentTransactions">) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Dernières transactions</CardTitle>
          <Link href="/transactions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Voir tout <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune transaction ce mois-ci.</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{t.label}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                      style={{ borderColor: t.category.color ?? undefined, color: t.category.color ?? undefined }}
                    >
                      {t.category.name}
                    </Badge>
                    {t.date && <span>{formatDate(t.date)}</span>}
                  </div>
                </div>
                <span className={`text-sm font-medium tabular-nums shrink-0 ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentTransfers({ recentTransfers }: Pick<DashboardData, "recentTransfers">) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            Derniers virements
          </CardTitle>
          <Link href="/transfers" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Voir tout <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {recentTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun virement ce mois-ci.</p>
        ) : (
          <div className="space-y-3">
            {recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{t.label}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full inline-block"
                        style={{ backgroundColor: t.account.color ?? "#6b7280" }}
                      />
                      {t.account.name}
                    </span>
                    <span>→</span>
                    {t.destinationAccount && (
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: t.destinationAccount.color ?? "#6b7280" }}
                        />
                        {t.destinationAccount.name}
                      </span>
                    )}
                    {t.date && <span className="ml-1">{formatDate(t.date)}</span>}
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 text-blue-600">
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
