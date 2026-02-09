export const dynamic = "force-dynamic";

import { getApiToken } from "@/app/settings/_actions/settings-actions";
import { ApiTokenCard } from "@/app/settings/_components/api-token-card";

export default async function SettingsPage() {
  const token = await getApiToken();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Réglages</h1>
      <ApiTokenCard initialToken={token} />
    </div>
  );
}
