"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { deleteTransfer } from "../_actions/transfer-actions";
import { TransferFormDialog } from "./transfer-form-dialog";
import { toast } from "sonner";
import { type FormAccount, type FormCategory, type SerializedTransfer } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  PENDING: { label: "En attente", variant: "outline", className: "border-orange-400 text-orange-600" },
  COMPLETED: { label: "Réalisé", variant: "outline", className: "border-green-500 text-green-600" },
  CANCELLED: { label: "Annulé", variant: "outline", className: "border-red-400 text-red-600" },
};

export function TransferList({
  transfers,
  accounts,
  categories,
  year,
  month,
}: {
  transfers: SerializedTransfer[];
  accounts: FormAccount[];
  categories: FormCategory[];
  year: number;
  month: number;
}) {
  const [editingTransfer, setEditingTransfer] = useState<SerializedTransfer | null>(null);

  async function handleDelete(id: string) {
    const result = await deleteTransfer(id);
    if ("error" in result) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Virement supprimé");
    }
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ArrowRightLeft className="h-12 w-12 mb-4 opacity-50" />
        <p>Aucun virement ce mois-ci.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transfers.map((t) => {
          const statusConfig = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.PENDING;
          const isCancelled = t.status === "CANCELLED";

          return (
            <Card key={t.id} className={isCancelled ? "opacity-50" : ""}>
              <CardContent className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{t.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-blue-600 shrink-0">
                        {formatCurrency(Math.abs(t.amount))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: t.account?.color ?? "#6b7280" }}
                        />
                        {t.account?.name ?? "—"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      {t.destinationAccount && (
                        <span className="flex items-center gap-1">
                          <span
                            className="h-2 w-2 rounded-full inline-block"
                            style={{ backgroundColor: t.destinationAccount.color ?? "#6b7280" }}
                          />
                          {t.destinationAccount.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      {t.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: t.category.color ?? undefined, color: t.category.color ?? undefined }}
                        >
                          {t.category.name}
                        </Badge>
                      )}
                      {t.bucket && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {t.bucket.name}
                        </Badge>
                      )}
                      <Badge variant={statusConfig.variant} className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
                        {statusConfig.label}
                      </Badge>
                      {t.date && (
                        <span className="text-muted-foreground">{formatDate(t.date)}</span>
                      )}
                    </div>

                    {t.note && (
                      <p className="text-xs text-muted-foreground italic">{t.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingTransfer(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingTransfer && (
        <TransferFormDialog
          accounts={accounts}
          categories={categories}
          year={year}
          month={month}
          transfer={editingTransfer}
          open={!!editingTransfer}
          onOpenChange={(open) => { if (!open) setEditingTransfer(null); }}
        />
      )}
    </>
  );
}
