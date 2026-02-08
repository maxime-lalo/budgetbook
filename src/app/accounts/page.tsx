import { getAccounts, getCheckingAccounts } from "./_actions/account-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AccountFormDialog } from "./_components/account-form-dialog";
import { BucketFormDialog } from "./_components/bucket-form-dialog";
import { DeleteAccountButton, DeleteBucketButton } from "./_components/delete-buttons";
import { formatCurrency, ACCOUNT_TYPE_LABELS } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

async function getBucketBalances(bucketIds: string[]) {
  const balances: Record<string, number> = {};
  for (const id of bucketIds) {
    const result = await prisma.transaction.aggregate({
      where: { bucketId: id, status: "COMPLETED" },
      _sum: { amount: true },
    });
    // Signe inversé : négatif sur un compte épargne = versement (solde augmente)
    balances[id] = -(result._sum.amount?.toNumber() ?? 0);
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
          const rawBalance = account.transactions.reduce(
            (sum, t) => sum + Number(t.amount),
            0
          );
          // Signe inversé pour épargne/investissement : négatif = versement (solde augmente)
          const balance = isSavingsOrInvestment ? -rawBalance : rawBalance;

          return (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: account.color ?? "#6b7280" }}
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
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(balance)}
                  </span>
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
                      const bucketBalance = bucketBalances[bucket.id] ?? 0;
                      const goal = bucket.goal ? Number(bucket.goal) : null;
                      const progress = goal ? Math.min((bucketBalance / goal) * 100, 100) : null;

                      return (
                        <div key={bucket.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: bucket.color ?? "#6b7280" }}
                              />
                              <span className="text-sm font-medium">{bucket.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {formatCurrency(bucketBalance)}
                                {goal && (
                                  <span className="text-muted-foreground"> / {formatCurrency(goal)}</span>
                                )}
                              </span>
                              <BucketFormDialog accountId={account.id} bucket={bucket} />
                              <DeleteBucketButton id={bucket.id} />
                            </div>
                          </div>
                          {progress !== null && (
                            <Progress value={progress} className="h-2" />
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
