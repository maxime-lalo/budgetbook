"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type CancelTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancelNote: string;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function CancelTransactionDialog({
  open,
  onOpenChange,
  cancelNote,
  onNoteChange,
  onConfirm,
  onClose,
}: CancelTransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Raison de l&apos;annulation</Label>
            <Textarea
              value={cancelNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Indiquez la raison..."
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Retour
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Confirmer l&apos;annulation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
