export const dynamic = "force-dynamic";

import { getAccounts, getCheckingAccounts } from "./_actions/account-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AccountFormDialog } from "./_components/account-form-dialog";
import { BucketFormDialog } from "./_components/bucket-form-dialog";
import { DeleteAccountButton, DeleteBucketButton } from "./_components/delete-buttons";
import { formatCurrency, ACCOUNT_TYPE_LABELS, DEFAULT_COLOR } from "@/lib/formatters";
import { db, buckets as bucketsTable, transactions as transactionsTable } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { toNumber } from "@/lib/db/helpers";

async function getBucketBalances(bucketIds: string[]) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const balances: Record<string, { current: number; forecast: number }> = {};

  if (bucketIds.length === 0) return balances;

  const buckets = await db.query.buckets.findMany({
    where: inArray(bucketsTable.id, bucketIds),
    columns: { id: true, baseAmount: true, accountId: true },
  });
  const baseAmountMap = new Map<string, number>(buckets.map((b) => [b.id, toNumber(b.baseAmount)]));
  const accountIdMap = new Map<string, string>(buckets.map((b) => [b.id, b.accountId]));

  const allTxs = await db.query.transactions.findMany({
    where: and(inArray(transactionsTable.bucketId, bucketIds), eq(transactionsTable.status, "COMPLETED")),
    columns: { bucketId: true, amount: true, year: true, month: true, accountId: true, destinationAccountId: true },
  });

  const txsByBucket = new Map<string, typeof allTxs>();
  for (const tx of allTxs) {
    if (!tx.bucketId) continue;
    const group = txsByBucket.get(tx.bucketId) ?? [];
    group.push(tx);
    txsByBucket.set(tx.bucketId, group);
  }

  for (const id of bucketIds) {
    const txs = txsByBucket.get(id) ?? [];
    const base = baseAmountMap.get(id) ?? 0;
    const bucketAccountId = accountIdMap.get(id);
    let currentSum = 0;
    let totalSum = 0;
    for (const t of txs) {
      const amt = toNumber(t.amount);
      const isOutgoing = t.accountId === bucketAccountId && t.destinationAccountId !== null;
      const effective = isOutgoing ? amt : -amt;
      totalSum += effective;
      if (t.year < currentYear || (t.year === currentYear && t.month <= currentMonth)) {
        currentSum += effective;
      }
    }
    balances[id] = {
      current: currentSum + base,
      forecast: totalSum + base,
    };
  }
  return balances;
}

export default async function AccountsPage() {
  const [accounts, checkingAccounts] = await Promise.all([
    getAccounts(),
    getCheckingAccounts(),
  ]);

  const allBucketIds = accounts.flatMap((a) => a.buckets.map((b) => b.id));
  const bucketBalances = await getBucketBalances(allBucketIds);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptes</h1>
          <p className="text-muted-foreground">Gérez vos comptes bancaires et buckets d&apos;épargne.</p>
        </div>
        <AccountFormDialog checkingAccounts={checkingAccounts} />
      </div>

      <div className="grid gap-6">
        {accounts.map((account) => {
          const isSavingsOrInvestment = account.type === "SAVINGS" || account.type === "INVESTMENT";
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;

          // Séparer standalone (non-virement) et virements sortants
          let currentStandalone = 0;
          let totalStandalone = 0;
          let currentOutgoing = 0;
          let totalOutgoing = 0;
          for (const t of account.transactions) {
            const isCurrent = t.year < currentYear || (t.year === currentYear && t.month <= currentMonth);
            if (t.destinationAccountId) {
              // Virement sortant : montant direct (négatif = débit)
              totalOutgoing += t.amount;
              if (isCurrent) currentOutgoing += t.amount;
            } else {
              totalStandalone += t.amount;
              if (isCurrent) currentStandalone += t.amount;
            }
          }

          // Virements entrants : negate (négatif inversé = crédit positif)
          let currentIncoming = 0;
          let totalIncoming = 0;
          for (const t of account.incomingTransfers) {
            const isCurrent = t.year < currentYear || (t.year === currentYear && t.month <= currentMonth);
            totalIncoming += t.amount;
            if (isCurrent) currentIncoming += t.amount;
          }

          const bucketsBaseAmount = account.buckets.reduce((sum, b) => sum + (b.baseAmount ?? 0), 0);
          const standaloneBalance = isSavingsOrInvestment ? -currentStandalone : currentStandalone;
          const standaloneForecast = isSavingsOrInvestment ? -totalStandalone : totalStandalone;
          const balance = standaloneBalance + currentOutgoing + (-currentIncoming) + bucketsBaseAmount;
          const forecast = standaloneForecast + totalOutgoing + (-totalIncoming) + bucketsBaseAmount;
          const hasForecast = Math.abs(forecast - balance) > 0.005;

          return (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: account.color ?? DEFAULT_COLOR }}
                  />
                  <div>
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </Badge>
                      {account.linkedAccount && (
                        <Badge variant="secondary">
                          Lié à {account.linkedAccount.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`text-xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(balance)}
                    </span>
                    {hasForecast && (
                      <div className={`text-xs text-muted-foreground`}>
                        Prévisionnel : <span className={forecast >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(forecast)}</span>
                      </div>
                    )}
                  </div>
                  <AccountFormDialog account={account} checkingAccounts={checkingAccounts} />
                  <DeleteAccountButton id={account.id} />
                </div>
              </CardHeader>

              {account.buckets.length > 0 && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">Buckets</h3>
                      <BucketFormDialog accountId={account.id} />
                    </div>
                    {account.buckets.map((bucket) => {
                      const bucketBal = bucketBalances[bucket.id] ?? { current: 0, forecast: 0 };
                      const bucketBalance = bucketBal.current;
                      const bucketForecast = bucketBal.forecast;
                      const bucketHasForecast = Math.abs(bucketForecast - bucketBalance) > 0.005;
                      const goal = bucket.goal ? Number(bucket.goal) : null;

                      return (
                        <div key={bucket.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: bucket.color ?? DEFAULT_COLOR }}
                              />
                              <span className="text-sm font-medium">{bucket.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="text-sm font-medium">
                                  {formatCurrency(bucketBalance)}
                                  {goal && (
                                    <span className="text-muted-foreground"> / {formatCurrency(goal)}</span>
                                  )}
                                </span>
                                {bucketHasForecast && (
                                  <div className="text-xs text-muted-foreground">
                                    Prév. : {formatCurrency(bucketForecast)}
                                  </div>
                                )}
                              </div>
                              <BucketFormDialog accountId={account.id} bucket={bucket} />
                              <DeleteBucketButton id={bucket.id} />
                            </div>
                          </div>
                          {goal !== null && (
                            <ProgressBar value={bucketBalance} max={goal} variant="goal" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}

              {account.buckets.length === 0 && (
                <CardContent>
                  <BucketFormDialog accountId={account.id} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
