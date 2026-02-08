"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Check, X, Trash2 } from "lucide-react";
import {
  markTransactionCompleted,
  cancelTransaction,
  deleteTransaction,
} from "../_actions/transaction-actions";
import { toast } from "sonner";

export function TransactionActionsCell({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");

  async function handleComplete() {
    await markTransactionCompleted(id);
    toast.success("Transaction marquée comme réalisée");
  }

  async function handleCancel() {
    if (!cancelNote.trim()) {
      toast.error("Une note est requise");
      return;
    }
    await cancelTransaction(id, cancelNote);
    toast.success("Transaction annulée");
    setCancelOpen(false);
    setCancelNote("");
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette transaction ?")) return;
    await deleteTransaction(id);
    toast.success("Transaction supprimée");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "PENDING" && (
            <DropdownMenuItem onClick={handleComplete}>
              <Check className="h-4 w-4 mr-2" />
              Marquer réalisée
            </DropdownMenuItem>
          )}
          {status !== "CANCELLED" && (
            <DropdownMenuItem onClick={() => setCancelOpen(true)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raison de l&apos;annulation</Label>
              <Textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Indiquez la raison..."
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Retour
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                Confirmer l&apos;annulation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
