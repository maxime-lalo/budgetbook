import { parseMonthParam, formatMonthYear, formatCurrency, formatDate, STATUS_LABELS } from "@/lib/formatters";
import { getTransactions, getTransactionTotals, getPreviousMonthBudgetRemaining } from "../_actions/transaction-actions";
import { getBudgetsWithSpent } from "@/app/budgets/_actions/budget-actions";
import { PrintButton } from "./_components/print-button";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);

  const [transactions, totals, carryOver, budgets] = await Promise.all([
    getTransactions(year, month),
    getTransactionTotals(year, month),
    getPreviousMonthBudgetRemaining(year, month),
    getBudgetsWithSpent(year, month),
  ]);

  const adjustedForecast = totals.forecast + carryOver;
  const recurring = transactions.filter((t) => t.date === null);
  const dated = transactions.filter((t) => t.date !== null);
  const transactionTotal = transactions
    .filter((t) => t.status !== "CANCELLED")
    .reduce((sum, t) => sum + t.amount, 0);

  const activeBudgets = budgets.filter((b) => b.budgeted > 0 || b.spent > 0);
  const budgetTotalBudgeted = activeBudgets.reduce((sum, b) => sum + b.budgeted, 0);
  const budgetTotalSpent = activeBudgets.reduce((sum, b) => sum + b.spent, 0);
  const budgetTotalRemaining = activeBudgets.reduce((sum, b) => sum + b.remaining, 0);

  const monthLabel = formatMonthYear(new Date(year, month - 1));

  return (
    <div className="max-w-4xl mx-auto space-y-8 print:space-y-4 print:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">Récapitulatif — {monthLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Généré le {formatDate(new Date())}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 print:gap-2">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Total sur compte</div>
          <div className={`text-lg font-bold ${totals.real + carryOver >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totals.real + carryOver)}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Reste à passer</div>
          <div className={`text-lg font-bold ${totals.pending >= 0 ? "text-blue-600" : "text-orange-600"}`}>
            {formatCurrency(totals.pending)}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Total réel</div>
          <div className={`text-lg font-bold ${adjustedForecast >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(adjustedForecast)}
          </div>
          {carryOver !== 0 && (
            <div className="text-xs text-muted-foreground">
              dont report : {formatCurrency(carryOver)}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Transactions</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2">
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-left py-2 px-2">Libellé</th>
              <th className="text-left py-2 px-2">Catégorie</th>
              <th className="text-left py-2 px-2">Statut</th>
              <th className="text-right py-2 px-2">Montant</th>
              <th className="text-left py-2 px-2">Compte</th>
            </tr>
          </thead>
          <tbody>
            {recurring.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} className="py-1 px-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    Récurrentes ({recurring.length})
                  </td>
                </tr>
                {recurring.map((t) => (
                  <TransactionPrintRow key={t.id} transaction={t} />
                ))}
              </>
            )}
            {dated.length > 0 && recurring.length > 0 && (
              <tr>
                <td colSpan={6} className="py-1 px-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  Transactions ({dated.length})
                </td>
              </tr>
            )}
            {dated.map((t) => (
              <TransactionPrintRow key={t.id} transaction={t} />
            ))}
            <tr className="border-t-2 font-bold">
              <td colSpan={4} className="py-2 px-2">Total</td>
              <td className={`py-2 px-2 text-right tabular-nums ${transactionTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(transactionTotal)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Budget Table */}
      {activeBudgets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Budgets</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2 px-2">Catégorie</th>
                <th className="text-right py-2 px-2">Budgété</th>
                <th className="text-right py-2 px-2">Dépensé</th>
                <th className="text-right py-2 px-2">Restant</th>
              </tr>
            </thead>
            <tbody>
              {activeBudgets.map((b) => (
                <tr key={b.id} className={`border-b ${b.remaining < 0 ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0 print:border print:border-gray-400"
                        style={{ backgroundColor: b.color ?? "#6b7280" }}
                      />
                      {b.name}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(b.budgeted)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-red-600">{formatCurrency(b.spent)}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${b.remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(b.remaining)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold">
                <td className="py-2 px-2">Total</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(budgetTotalBudgeted)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-red-600">{formatCurrency(budgetTotalSpent)}</td>
                <td className={`py-2 px-2 text-right tabular-nums ${budgetTotalRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(budgetTotalRemaining)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionPrintRow({ transaction: t }: { transaction: {
  id: string;
  label: string;
  amount: number;
  date: string | null;
  status: string;
  category: { name: string; color: string | null } | null;
  account: { name: string; color: string | null } | null;
} }) {
  const isCancelled = t.status === "CANCELLED";
  return (
    <tr className={`border-b ${isCancelled ? "opacity-50 line-through" : ""}`}>
      <td className="py-1.5 px-2 text-muted-foreground">
        {t.date ? formatDate(t.date) : "—"}
      </td>
      <td className="py-1.5 px-2">{t.label}</td>
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full shrink-0 print:border print:border-gray-400"
            style={{ backgroundColor: t.category?.color ?? "#6b7280" }}
          />
          <span className="text-xs">{t.category?.name ?? "Sans catégorie"}</span>
        </div>
      </td>
      <td className="py-1.5 px-2 text-xs">{STATUS_LABELS[t.status] ?? t.status}</td>
      <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
        {formatCurrency(t.amount)}
      </td>
      <td className="py-1.5 px-2 text-xs text-muted-foreground">{t.account?.name ?? "—"}</td>
    </tr>
  );
}
