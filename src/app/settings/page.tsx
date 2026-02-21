export const dynamic = "force-dynamic";

import { getApiToken, getAppPreferences } from "@/app/settings/_actions/settings-actions";
import { AmexToggleCard } from "@/app/settings/_components/amex-toggle-card";
import { ApiTokenCard } from "@/app/settings/_components/api-token-card";
import { ExportDataCard } from "@/app/settings/_components/export-data-card";
import { ImportDataCard } from "@/app/settings/_components/import-data-card";
import { ClearDataCard } from "@/app/settings/_components/clear-data-card";
import { RecalculateBalancesCard } from "@/app/settings/_components/recalculate-balances-card";

export default async function SettingsPage() {
  const [token, prefs] = await Promise.all([
    getApiToken(),
    getAppPreferences(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Réglages</h1>
      <AmexToggleCard initialEnabled={prefs.amexEnabled} />
      <ApiTokenCard initialToken={token} />
      <RecalculateBalancesCard />
      <ExportDataCard />
      <ImportDataCard />
      <ClearDataCard />
    </div>
  );
}
