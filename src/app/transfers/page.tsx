import { Suspense } from "react";
import { parseMonthParam } from "@/lib/formatters";
import { getTransfers, getTransferFormData } from "./_actions/transfer-actions";
import { MonthNavigator } from "@/app/transactions/_components/month-navigator";
import { TransferFormDialog } from "./_components/transfer-form-dialog";
import { TransferList } from "./_components/transfer-list";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const [transfers, formData] = await Promise.all([
    getTransfers(year, month),
    getTransferFormData(),
  ]);

  return (
    <div className="space-y-2 sm:space-y-6 pb-20 sm:pb-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Virements</h1>
          <p className="text-muted-foreground">Transferts inter-comptes du mois.</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4">
          <TransferFormDialog
            accounts={formData.accounts}
            categories={formData.categories}
            year={year}
            month={month}
          />
          <Suspense fallback={<Skeleton className="h-10 w-[250px]" />}>
            <MonthNavigator />
          </Suspense>
        </div>
      </div>

      <TransferList
        transfers={transfers}
        accounts={formData.accounts}
        categories={formData.categories}
        year={year}
        month={month}
      />
    </div>
  );
}
