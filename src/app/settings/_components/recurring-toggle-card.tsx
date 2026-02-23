"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateSeparateRecurring } from "@/app/settings/_actions/settings-actions";
import { toast } from "sonner";

export function RecurringToggleCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    setLoading(true);
    try {
      await updateSeparateRecurring(checked);
      toast.success(checked ? "Sections séparées activées" : "Sections séparées désactivées");
    } catch {
      setEnabled(!checked);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions récurrentes</CardTitle>
        <CardDescription>
          Séparer les transactions récurrentes (sans date) dans une section dédiée pliable.
          Désactiver affiche toutes les transactions dans une liste unique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading}
            id="recurring-toggle"
          />
          <Label htmlFor="recurring-toggle">
            {enabled ? "Séparées" : "Liste unique"}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
