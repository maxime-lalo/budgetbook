"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction } from "../_actions/transaction-actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { format } from "date-fns";

type Account = {
  id: string;
  name: string;
  type: string;
  buckets: { id: string; name: string }[];
  linkedCards: { id: string; name: string }[];
};

type Category = {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
};

export function TransactionFormDialog({
  accounts,
  categories,
  year,
  month,
}: {
  accounts: Account[];
  categories: Category[];
  year: number;
  month: number;
}) {
  const [open, setOpen] = useState(false);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [isAmex, setIsAmex] = useState(false);
  const [noDate, setNoDate] = useState(false);
  const [dateValue, setDateValue] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isExpense, setIsExpense] = useState(true);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const showBuckets = selectedAccount && (selectedAccount.type === "SAVINGS" || selectedAccount.type === "INVESTMENT") && selectedAccount.buckets.length > 0;

  const showAmexToggle = selectedAccount?.type === "CHECKING";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const num = Number(formData.get("amount"));
    const data: Record<string, unknown> = {
      label: formData.get("label"),
      amount: isExpense ? -Math.abs(num) : Math.abs(num),
      date: noDate ? null : formData.get("date"),
      month,
      year,
      status,
      note: formData.get("note") || null,
      accountId,
      categoryId,
      subCategoryId: formData.get("subCategoryId") || null,
      bucketId: formData.get("bucketId") === "__none__" ? null : formData.get("bucketId") || null,
      isAmex,
    };

    const result = await createTransaction(data);

    if (result.error) {
      const errors = result.error;
      const msg = Object.values(errors).flat().join(", ");
      toast.error(msg || "Erreur de validation");
      return;
    }
    toast.success("Transaction créée");
    setOpen(false);
  }

  function handleNoDateChange(checked: boolean) {
    setNoDate(checked);
    setDateValue(checked ? "" : format(new Date(), "yyyy-MM-dd"));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              name="label"
              required
            />
          </div>

          {!isAmex && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isExpense ? "default" : "outline"}
                onClick={() => setIsExpense(true)}
                className="flex-1"
              >
                Dépense
              </Button>
              <Button
                type="button"
                variant={!isExpense ? "default" : "outline"}
                onClick={() => setIsExpense(false)}
                className="flex-1"
              >
                Rentrée
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="50.00"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="date">Date</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="no-date" className="text-xs text-muted-foreground">Récurrent</Label>
                  <Switch
                    id="no-date"
                    checked={noDate}
                    onCheckedChange={handleNoDateChange}
                  />
                </div>
              </div>
              <Input
                id="date"
                name="date"
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                disabled={noDate}
                required={!noDate}
                className={noDate ? "cursor-not-allowed opacity-50" : ""}
              />
            </div>
          </div>

          {showAmexToggle && (
            <div className="flex items-center gap-3">
              <Switch
                checked={isAmex}
                onCheckedChange={(checked) => {
                  setIsAmex(checked);
                  if (checked) setIsExpense(true);
                }}
              />
              <Label>AMEX</Label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <Select
                name="subCategoryId"
                disabled={!selectedCategory || selectedCategory.subCategories.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategory?.subCategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Compte</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
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
              <Label>Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="COMPLETED">Réalisé</SelectItem>
                  <SelectItem value="CANCELLED">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showBuckets && (
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Select name="bucketId" defaultValue={selectedAccount.buckets[0].id}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedAccount.buckets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {status === "CANCELLED" && (
            <div className="space-y-2">
              <Label htmlFor="note">Note (obligatoire)</Label>
              <Textarea
                id="note"
                name="note"
                required
                placeholder="Raison de l'annulation..."
              />
            </div>
          )}

          {status !== "CANCELLED" && (
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                name="note"
                placeholder="Optionnel..."
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
