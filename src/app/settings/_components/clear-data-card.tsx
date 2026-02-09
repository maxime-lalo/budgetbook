"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clearAllData } from "@/app/settings/_actions/settings-actions";

const CONFIRM_KEYWORD = "SUPPRIMER";

export function ClearDataCard() {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleClear() {
    setDialogOpen(false);
    setLoading(true);
    try {
      const result = await clearAllData();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Toutes les données ont été supprimées");
      }
    } catch {
      toast.error("Erreur lors de la suppression des données");
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle>Supprimer toutes les données</CardTitle>
        <CardDescription>
          Supprimer définitivement tous les comptes, catégories, transactions, budgets et
          soldes mensuels. Le token API sera conservé.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmText(""); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {loading ? "Suppression en cours..." : "Supprimer"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer toutes les données ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Toutes les données (comptes, catégories,
                transactions, budgets) seront définitivement supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-2">
                Tapez <span className="font-mono font-bold">{CONFIRM_KEYWORD}</span> pour confirmer :
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_KEYWORD}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleClear}
                disabled={confirmText !== CONFIRM_KEYWORD}
              >
                Confirmer la suppression
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
