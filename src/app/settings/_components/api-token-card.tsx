"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Eye, EyeOff, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regenerateApiToken } from "@/app/settings/_actions/settings-actions";

interface ApiTokenCardProps {
  initialToken: { token: string; createdAt: string } | null;
}

export function ApiTokenCard({ initialToken }: ApiTokenCardProps) {
  const [tokenData, setTokenData] = useState(initialToken);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await regenerateApiToken();
      setTokenData(result);
      setVisible(true);
      toast.success("Token généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du token");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!tokenData) return;
    await navigator.clipboard.writeText(tokenData.token);
    toast.success("Token copié dans le presse-papiers");
  }

  const createdDate = tokenData
    ? new Date(tokenData.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token API</CardTitle>
        <CardDescription>
          Token d&apos;authentification pour les appels API externes (Tasker, n8n, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!tokenData ? (
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Génération..." : "Générer un token"}
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={visible ? tokenData.token : "••••••••••••••••••••••••••••••••••••"}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setVisible(!visible)}
                title={visible ? "Masquer" : "Afficher"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copier">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Créé le {createdDate}
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Régénérer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Régénérer le token ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L&apos;ancien token sera immédiatement invalidé. Toutes les intégrations
                    utilisant l&apos;ancien token cesseront de fonctionner.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerate}>
                    Régénérer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
