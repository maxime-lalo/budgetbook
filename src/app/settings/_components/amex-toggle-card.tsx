"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateAmexEnabled } from "@/app/settings/_actions/settings-actions";
import { toast } from "sonner";

interface AmexToggleCardProps {
  initialEnabled: boolean;
}

export function AmexToggleCard({ initialEnabled }: AmexToggleCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    setLoading(true);
    try {
      await updateAmexEnabled(checked);
      toast.success(checked ? "AMEX activé" : "AMEX désactivé");
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
        <CardTitle>Carte AMEX</CardTitle>
        <CardDescription>
          Activer ou désactiver le support des transactions AMEX (débit différé).
          Désactiver masque tous les boutons et badges AMEX dans l&apos;application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading}
            id="amex-toggle"
          />
          <Label htmlFor="amex-toggle">
            {enabled ? "Activé" : "Désactivé"}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
