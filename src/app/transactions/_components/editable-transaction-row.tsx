"use client";

import { useState, useCallback } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, CreditCard } from "lucide-react";
import { STATUS_LABELS } from "@/lib/formatters";
import {
  updateTransactionField,
  cancelTransaction,
  deleteTransaction,
} from "../_actions/transaction-actions";
import { toast } from "sonner";
import { format } from "date-fns";

type Transaction = {
  id: string;
  label: string;
  amount: number;
  date: string | null;
  month: number;
  year: number;
  status: string;
  note: string | null;
  accountId: string;
  categoryId: string;
  subCategoryId: string | null;
  bucketId: string | null;
  isAmex: boolean;
  account: { name: string; color: string | null };
  category: { name: string; color: string | null };
  subCategory: { name: string } | null;
  bucket: { name: string } | null;
};

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
  color: string | null;
  subCategories: { id: string; name: string }[];
};

export function EditableTransactionRow({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [label, setLabel] = useState(transaction.label);
  const [amount, setAmount] = useState(transaction.amount.toFixed(2));
  const [date, setDate] = useState(
    transaction.date ? format(new Date(transaction.date), "yyyy-MM-dd") : ""
  );
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [isAmex, setIsAmex] = useState(transaction.isAmex);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [subCategoryId, setSubCategoryId] = useState(transaction.subCategoryId ?? "");
  const [status, setStatus] = useState(transaction.status);

  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [pendingAccountChange, setPendingAccountChange] = useState<{
    newAccountId: string;
    prevAccountId: string;
    prevAmex: boolean;
    shouldResetAmex: boolean;
    buckets: { id: string; name: string }[];
  } | null>(null);
  const [selectedBucketForChange, setSelectedBucketForChange] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState(date);
  const [editRecurring, setEditRecurring] = useState(date === "");
  const [editMonth, setEditMonth] = useState(
    `${transaction.year}-${String(transaction.month).padStart(2, "0")}`
  );
  const [editAccountId, setEditAccountId] = useState(accountId);
  const [editBucketId, setEditBucketId] = useState(transaction.bucketId ?? "");

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const saveField = useCallback(
    async (
      fields: Parameters<typeof updateTransactionField>[1],
      rollback?: () => void
    ) => {
      const result = await updateTransactionField(transaction.id, fields);
      if (!result.success) {
        toast.error("Erreur lors de la mise à jour");
        rollback?.();
      }
    },
    [transaction.id]
  );

  function handleLabelBlur() {
    if (label === transaction.label) return;
    if (!label.trim()) {
      setLabel(transaction.label);
      return;
    }
    saveField({ label }, () => setLabel(transaction.label));
  }

  function handleAmountBlur() {
    const num = Number(amount);
    if (isNaN(num) || num === 0) {
      setAmount(transaction.amount.toFixed(2));
      return;
    }
    setAmount(num.toFixed(2));
    if (num === transaction.amount) return;
    saveField({ amount: num }, () => {
      setAmount(transaction.amount.toFixed(2));
    });
  }

  function handleAccountChange(value: string) {
    const prev = accountId;
    const prevAmex = isAmex;
    const newAccount = accounts.find((a) => a.id === value);
    const shouldResetAmex = isAmex && newAccount?.type !== "CHECKING";
    const hasBuckets = newAccount && (newAccount.type === "SAVINGS" || newAccount.type === "INVESTMENT") && newAccount.buckets.length > 0;

    if (hasBuckets) {
      setPendingAccountChange({
        newAccountId: value,
        prevAccountId: prev,
        prevAmex,
        shouldResetAmex,
        buckets: newAccount.buckets,
      });
      setSelectedBucketForChange(newAccount.buckets[0].id);
      setBucketDialogOpen(true);
      return;
    }

    setAccountId(value);
    if (shouldResetAmex) setIsAmex(false);
    const fields: Parameters<typeof updateTransactionField>[1] = { accountId: value, bucketId: null };
    if (shouldResetAmex) fields.isAmex = false;
    saveField(fields, () => { setAccountId(prev); if (shouldResetAmex) setIsAmex(prevAmex); });
  }

  async function handleBucketChangeConfirm() {
    if (!pendingAccountChange) return;
    const { newAccountId, prevAccountId, prevAmex, shouldResetAmex } = pendingAccountChange;

    setAccountId(newAccountId);
    if (shouldResetAmex) setIsAmex(false);

    const fields: Parameters<typeof updateTransactionField>[1] = {
      accountId: newAccountId,
      bucketId: selectedBucketForChange,
    };
    if (shouldResetAmex) fields.isAmex = false;

    setBucketDialogOpen(false);
    setTimeout(() => {
      setPendingAccountChange(null);
      setSelectedBucketForChange("");
    }, 300);

    saveField(fields, () => {
      setAccountId(prevAccountId);
      if (shouldResetAmex) setIsAmex(prevAmex);
    });
  }

  function handleBucketChangeCancel() {
    setBucketDialogOpen(false);
    setPendingAccountChange(null);
    setSelectedBucketForChange("");
  }

  function handleAmexToggle() {
    const prev = isAmex;
    const newVal = !isAmex;
    setIsAmex(newVal);
    saveField({ isAmex: newVal }, () => setIsAmex(prev));
  }

  function handleCategoryChange(value: string) {
    const prevCat = categoryId;
    const prevSub = subCategoryId;
    setCategoryId(value);
    setSubCategoryId("");
    saveField(
      { categoryId: value, subCategoryId: null },
      () => {
        setCategoryId(prevCat);
        setSubCategoryId(prevSub);
      }
    );
  }

  function handleSubCategoryChange(value: string) {
    const prev = subCategoryId;
    const newSubId = value === "__none__" ? null : value;
    setSubCategoryId(newSubId ?? "");
    saveField({ subCategoryId: newSubId }, () => setSubCategoryId(prev));
  }

  function handleStatusChange(value: string) {
    if (value === "CANCELLED") {
      setCancelDialogOpen(true);
      return;
    }
    const prev = status;
    setStatus(value);
    saveField({ status: value }, () => setStatus(prev));
  }

  async function handleCancelConfirm() {
    if (!cancelNote.trim()) {
      toast.error("Une note est requise");
      return;
    }
    const result = await cancelTransaction(transaction.id, cancelNote);
    if (result.error) {
      toast.error(result.error as string);
      return;
    }
    setStatus("CANCELLED");
    setCancelDialogOpen(false);
    setCancelNote("");
  }

  function handleCancelDialogClose(open: boolean) {
    if (!open) {
      setCancelDialogOpen(false);
      setCancelNote("");
    }
  }

  async function handleDelete() {
    await deleteTransaction(transaction.id);
    toast.success("Transaction supprimée");
  }

  // Modal d'édition Date + Compte
  function openEditDialog() {
    setEditDate(date);
    setEditRecurring(date === "");
    setEditMonth(`${transaction.year}-${String(transaction.month).padStart(2, "0")}`);
    setEditAccountId(accountId);
    const currentAccount = accounts.find((a) => a.id === accountId);
    const hasBuckets = currentAccount && (currentAccount.type === "SAVINGS" || currentAccount.type === "INVESTMENT") && currentAccount.buckets.length > 0;
    setEditBucketId(transaction.bucketId ?? (hasBuckets ? currentAccount.buckets[0].id : ""));
    setEditDialogOpen(true);
  }

  async function handleEditSave() {
    const fields: Parameters<typeof updateTransactionField>[1] = {};
    const originalDate = transaction.date
      ? format(new Date(transaction.date), "yyyy-MM-dd")
      : "";
    const effectiveDate = editRecurring ? "" : editDate;

    if (effectiveDate !== originalDate) {
      fields.date = effectiveDate === "" ? null : effectiveDate;
    }
    if (editAccountId !== accountId) {
      fields.accountId = editAccountId;
    }
    const originalMonth = `${transaction.year}-${String(transaction.month).padStart(2, "0")}`;
    if (editMonth !== originalMonth) {
      const [y, m] = editMonth.split("-").map(Number);
      fields.year = y;
      fields.month = m;
    }
    const newBucketId = editBucketId || null;
    if (newBucketId !== (transaction.bucketId ?? null)) {
      fields.bucketId = newBucketId;
    }

    if (Object.keys(fields).length === 0) {
      setEditDialogOpen(false);
      return;
    }

    const result = await updateTransactionField(transaction.id, fields);
    if (!result.success) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    // Mettre à jour les states locaux
    if (fields.date !== undefined) {
      setDate(effectiveDate);
    }
    if (fields.accountId) {
      setAccountId(editAccountId);
    }
    setEditDialogOpen(false);
  }

  return (
    <>
      <TableRow className={status === "CANCELLED" ? "opacity-50" : ""}>
        {/* Libellé */}
        <TableCell className="p-1">
          <Input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
            className="h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input"
          />
        </TableCell>

        {/* Catégorie + Sous-catégorie */}
        <TableCell className="p-1 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? "#6b7280" }}
                      />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && selectedCategory.subCategories.length > 0 && (
              <Select value={subCategoryId || "__none__"} onValueChange={handleSubCategoryChange}>
                <SelectTrigger className="w-full h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input">
                  <SelectValue placeholder="Sous-cat." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {selectedCategory.subCategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </TableCell>

        {/* Statut */}
        <TableCell className="p-1 whitespace-nowrap">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0 bg-orange-500" />
                  {STATUS_LABELS.PENDING}
                </div>
              </SelectItem>
              <SelectItem value="COMPLETED">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0 bg-green-500" />
                  {STATUS_LABELS.COMPLETED}
                </div>
              </SelectItem>
              <SelectItem value="CANCELLED">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0 bg-red-500" />
                  {STATUS_LABELS.CANCELLED}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </TableCell>

        {/* Montant */}
        <TableCell className="p-1 whitespace-nowrap">
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={handleAmountBlur}
            className={`h-8 text-sm text-center border-transparent bg-transparent hover:border-input focus:border-input w-full font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              Number(amount) < 0 ? "text-red-600" : "text-green-600"
            }`}
          />
        </TableCell>

        {/* Compte */}
        <TableCell className="p-1 whitespace-nowrap">
          <div className="flex items-center gap-1">
            {accounts.find((a) => a.id === accountId)?.type === "CHECKING" && (
              <button
                type="button"
                onClick={handleAmexToggle}
                title={isAmex ? "AMEX activé" : "Activer AMEX"}
                className={`shrink-0 p-1 rounded ${isAmex ? "text-blue-600 bg-blue-100 dark:bg-blue-900/40" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              >
                <CreditCard className="h-3.5 w-3.5" />
              </button>
            )}
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger className="w-full h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input">
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
        </TableCell>

        {/* Actions directes */}
        <TableCell className="p-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openEditDialog}
              title="Éditer date et compte"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Dialog de sélection de bucket (changement de compte) */}
      <Dialog open={bucketDialogOpen} onOpenChange={(open) => { if (!open) handleBucketChangeCancel(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sélectionner un bucket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ce compte possède des buckets. Veuillez en sélectionner un.
            </p>
            <Select value={selectedBucketForChange} onValueChange={setSelectedBucketForChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pendingAccountChange?.buckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBucketChangeCancel}>
                Annuler
              </Button>
              <Button onClick={handleBucketChangeConfirm}>
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'annulation */}
      <Dialog open={cancelDialogOpen} onOpenChange={handleCancelDialogClose}>
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
              <Button variant="outline" onClick={() => handleCancelDialogClose(false)}>
                Retour
              </Button>
              <Button variant="destructive" onClick={handleCancelConfirm}>
                Confirmer l&apos;annulation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition Date + Compte */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier date et compte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Date</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Récurrent</Label>
                  <Switch
                    checked={editRecurring}
                    onCheckedChange={setEditRecurring}
                  />
                </div>
              </div>
              {!editRecurring && (
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Mois budgétaire</Label>
              <Input
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Compte</Label>
              <Select value={editAccountId} onValueChange={(v) => {
                setEditAccountId(v);
                const newAccount = accounts.find((a) => a.id === v);
                const hasBuckets = newAccount && (newAccount.type === "SAVINGS" || newAccount.type === "INVESTMENT") && newAccount.buckets.length > 0;
                setEditBucketId(hasBuckets ? newAccount.buckets[0].id : "");
              }}>
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
            {(() => {
              const editAccount = accounts.find((a) => a.id === editAccountId);
              const showBuckets = editAccount && (editAccount.type === "SAVINGS" || editAccount.type === "INVESTMENT") && editAccount.buckets.length > 0;
              if (!showBuckets) return null;
              return (
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Select value={editBucketId} onValueChange={setEditBucketId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editAccount.buckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEditSave}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
