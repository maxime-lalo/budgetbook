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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FILTER_NONE } from "@/lib/formatters";
import { type FormAccount } from "@/lib/types";

type EditTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FormAccount[];
  editDate: string;
  onDateChange: (value: string) => void;
  editRecurring: boolean;
  onRecurringChange: (value: boolean) => void;
  editMonth: string;
  onMonthChange: (value: string) => void;
  editAccountId: string;
  onAccountChange: (value: string) => void;
  editDestinationAccountId: string;
  onDestinationAccountChange: (value: string) => void;
  editBucketId: string;
  onBucketChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function EditTransactionDialog({
  open,
  onOpenChange,
  accounts,
  editDate,
  onDateChange,
  editRecurring,
  onRecurringChange,
  editMonth,
  onMonthChange,
  editAccountId,
  onAccountChange,
  editDestinationAccountId,
  onDestinationAccountChange,
  editBucketId,
  onBucketChange,
  onSave,
  onClose,
}: EditTransactionDialogProps) {
  const isSavings = (a?: FormAccount) => a && (a.type === "SAVINGS" || a.type === "INVESTMENT") && a.buckets.length > 0;
  const destAcct = editDestinationAccountId ? accounts.find((a) => a.id === editDestinationAccountId) : undefined;
  const srcAcct = accounts.find((a) => a.id === editAccountId);
  const bucketAcct = isSavings(destAcct) ? destAcct : isSavings(srcAcct) ? srcAcct : undefined;
  const showBuckets = !!bucketAcct;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier date et compte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-recurring-switch">Date</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-recurring-switch" className="text-xs text-muted-foreground">Récurrent</Label>
                <Switch
                  id="edit-recurring-switch"
                  checked={editRecurring}
                  onCheckedChange={onRecurringChange}
                />
              </div>
            </div>
            <Input
              type="date"
              value={editDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mois budgétaire</Label>
            <Input
              type="month"
              value={editMonth}
              onChange={(e) => onMonthChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Compte</Label>
            <Select value={editAccountId} onValueChange={onAccountChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Compte destination</Label>
            <Select value={editDestinationAccountId || FILTER_NONE} onValueChange={onDestinationAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_NONE}>Aucun</SelectItem>
                {accounts.filter((a) => a.id !== editAccountId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showBuckets && bucketAcct && (
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Select value={editBucketId} onValueChange={onBucketChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bucketAcct.buckets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={onSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
