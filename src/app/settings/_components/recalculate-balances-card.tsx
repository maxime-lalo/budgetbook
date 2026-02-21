"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { recalculateAllBalances } from "@/app/settings/_actions/settings-actions";

export function RecalculateBalancesCard() {
  const [loading, setLoading] = useState(false);

  async function handleRecalculate() {
    setLoading(true);
    try {
      const result = await recalculateAllBalances();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${result.count} soldes mensuels recalculés`);
      }
    } catch {
      toast.error("Erreur lors du recalcul");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soldes mensuels</CardTitle>
        <CardDescription>
          Recalculer les soldes mensuels (report cumulatif) depuis les transactions et budgets.
          Utile si les montants de report semblent incorrects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleRecalculate} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Recalculer les soldes
        </Button>
      </CardContent>
    </Card>
  );
}
