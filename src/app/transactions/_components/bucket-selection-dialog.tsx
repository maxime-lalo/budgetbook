"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type BucketSelectionDialogProps = {
  open: boolean;
  buckets: { id: string; name: string }[];
  selectedBucketId: string;
  onBucketChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BucketSelectionDialog({
  open,
  buckets,
  selectedBucketId,
  onBucketChange,
  onConfirm,
  onCancel,
}: BucketSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sélectionner un bucket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ce compte possède des buckets. Veuillez en sélectionner un.
          </p>
          <Select value={selectedBucketId} onValueChange={onBucketChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {buckets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button onClick={onConfirm}>
              Confirmer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
