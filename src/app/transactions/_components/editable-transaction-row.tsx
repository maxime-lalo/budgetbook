"use client";

import { useState, useCallback, useTransition } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, CreditCard, ArrowRightLeft, RefreshCw } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, DEFAULT_COLOR, FILTER_NONE } from "@/lib/formatters";
import {
  updateTransactionField,
  cancelTransaction,
  deleteTransaction,
} from "../_actions/transaction-actions";
import { toast } from "sonner";
import { format } from "date-fns";
import { type SerializedTransaction, type FormAccount, type FormCategory, type TransactionStatus } from "@/lib/types";
import { BucketSelectionDialog } from "./bucket-selection-dialog";
import { CancelTransactionDialog } from "./cancel-transaction-dialog";
import { EditTransactionDialog } from "./edit-transaction-dialog";

export function EditableTransactionRow({
  transaction,
  accounts,
  categories,
  amexEnabled = true,
}: {
  transaction: SerializedTransaction;
  accounts: FormAccount[];
  categories: FormCategory[];
  amexEnabled?: boolean;
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
  const [, startEditTransition] = useTransition();
  const [editDate, setEditDate] = useState(date);
  const [editRecurring, setEditRecurring] = useState(transaction.recurring);
  const [editMonth, setEditMonth] = useState(
    `${transaction.year}-${String(transaction.month).padStart(2, "0")}`
  );
  const [editAccountId, setEditAccountId] = useState(accountId);
  const [editBucketId, setEditBucketId] = useState(transaction.bucketId ?? "");
  const [editDestinationAccountId, setEditDestinationAccountId] = useState(transaction.destinationAccountId ?? "");

  const isTransfer = transaction.destinationAccountId !== null;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const saveField = useCallback(
    async (
      fields: Parameters<typeof updateTransactionField>[1],
      rollback?: () => void
    ) => {
      const result = await updateTransactionField(transaction.id, fields);
      if ("error" in result) {
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

  function handleDateBlur() {
    const newDate = date || null;
    const oldDate = transaction.date ? format(new Date(transaction.date), "yyyy-MM-dd") : "";
    if (date === oldDate) return;
    saveField({ date: newDate || null }, () => setDate(oldDate));
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
    const newSubId = value === FILTER_NONE ? null : value;
    setSubCategoryId(newSubId ?? "");
    saveField({ subCategoryId: newSubId }, () => setSubCategoryId(prev));
  }

  function handleStatusChange(value: string) {
    const newStatus = value as TransactionStatus;
    if (newStatus === "CANCELLED") {
      setCancelDialogOpen(true);
      return;
    }
    const prev = status;
    setStatus(newStatus);
    saveField({ status: newStatus }, () => setStatus(prev));
  }

  async function handleCancelConfirm() {
    if (!cancelNote.trim()) {
      toast.error("Une note est requise");
      return;
    }
    const result = await cancelTransaction(transaction.id, cancelNote);
    if ("error" in result) {
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

  function openEditDialog() {
    setEditDate(date);
    setEditRecurring(transaction.recurring);
    setEditMonth(`${transaction.year}-${String(transaction.month).padStart(2, "0")}`);
    setEditAccountId(accountId);
    setEditDestinationAccountId(transaction.destinationAccountId ?? "");
    const bucketAccount = transaction.destinationAccountId
      ? accounts.find((a) => a.id === transaction.destinationAccountId)
      : accounts.find((a) => a.id === accountId);
    const hasBuckets = bucketAccount && (bucketAccount.type === "SAVINGS" || bucketAccount.type === "INVESTMENT") && bucketAccount.buckets.length > 0;
    setEditBucketId(transaction.bucketId ?? (hasBuckets ? bucketAccount.buckets[0].id : ""));
    setEditDialogOpen(true);
  }

  function handleEditAccountChange(v: string) {
    setEditAccountId(v);
    const newDest = v === editDestinationAccountId ? "" : editDestinationAccountId;
    if (v === editDestinationAccountId) setEditDestinationAccountId("");
    const isSav = (a?: FormAccount) => a && (a.type === "SAVINGS" || a.type === "INVESTMENT") && a.buckets.length > 0;
    const destAcct = newDest ? accounts.find((a) => a.id === newDest) : undefined;
    const srcAcct = accounts.find((a) => a.id === v);
    const ba = isSav(destAcct) ? destAcct : isSav(srcAcct) ? srcAcct : undefined;
    setEditBucketId(ba ? ba.buckets[0].id : "");
  }

  function handleEditDestinationAccountChange(v: string) {
    const newDest = v === FILTER_NONE ? "" : v;
    setEditDestinationAccountId(newDest);
    const isSav = (a?: FormAccount) => a && (a.type === "SAVINGS" || a.type === "INVESTMENT") && a.buckets.length > 0;
    const destAcct = newDest ? accounts.find((a) => a.id === newDest) : undefined;
    const srcAcct = accounts.find((a) => a.id === editAccountId);
    const ba = isSav(destAcct) ? destAcct : isSav(srcAcct) ? srcAcct : undefined;
    setEditBucketId(ba ? ba.buckets[0].id : "");
  }

  function handleEditSave() {
    const fields: Parameters<typeof updateTransactionField>[1] = {};
    const originalDate = transaction.date
      ? format(new Date(transaction.date), "yyyy-MM-dd")
      : "";

    if (editDate !== originalDate) {
      fields.date = editDate === "" ? null : editDate;
    }
    if (editRecurring !== transaction.recurring) {
      fields.recurring = editRecurring;
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
    const newDestId = editDestinationAccountId || null;
    if (newDestId !== (transaction.destinationAccountId ?? null)) {
      fields.destinationAccountId = newDestId;
    }

    if (Object.keys(fields).length === 0) return;

    // La fermeture est gérée par DialogClose (Radix) sur le bouton.
    // On lance juste la server action en arrière-plan.
    startEditTransition(async () => {
      const result = await updateTransactionField(transaction.id, fields);
      if ("error" in result) {
        toast.error("Erreur lors de la mise à jour");
        return;
      }
      if (fields.date !== undefined) setDate(editDate);
      if (fields.accountId) setAccountId(editAccountId);
    });
  }

  return (
    <>
      <TableRow className={status === "CANCELLED" ? "opacity-50" : ""}>
        <TableCell className="p-1">
          <div className="flex items-center gap-1">
            {transaction.recurring && (
              <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              className="h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input"
            />
          </div>
        </TableCell>

        <TableCell className="p-1 whitespace-nowrap text-center">
          {date ? (
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={handleDateBlur}
              className="h-8 text-sm text-center border-transparent bg-transparent hover:border-input focus:border-input w-[130px] text-muted-foreground"
            />
          ) : (
            <span className="inline-flex items-center h-8 px-2 text-xs font-medium text-muted-foreground bg-muted rounded-md">
              Récurrent
            </span>
          )}
        </TableCell>

        <TableCell className="p-1 whitespace-nowrap">
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={handleAmountBlur}
            className={`h-8 text-sm text-center border-transparent bg-transparent hover:border-input focus:border-input w-full font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              isTransfer ? "text-blue-600" : Number(amount) < 0 ? "text-red-600" : "text-green-600"
            }`}
          />
        </TableCell>

        <TableCell className="p-1 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <Select value={categoryId ?? ""} onValueChange={handleCategoryChange}>
              <SelectTrigger className={`w-full h-8 text-sm bg-transparent hover:border-input focus:border-input ${!categoryId ? "border-destructive" : "border-transparent"}`}>
                <SelectValue placeholder="Sans catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? DEFAULT_COLOR }}
                        aria-label={c.name}
                      />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && selectedCategory.subCategories.length > 0 && (
              <Select value={subCategoryId || FILTER_NONE} onValueChange={handleSubCategoryChange}>
                <SelectTrigger className={`w-full h-8 text-sm bg-transparent hover:border-input focus:border-input ${!subCategoryId ? "border-orange-500" : "border-transparent"}`}>
                  <SelectValue placeholder="Sous-cat." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_NONE}>Aucune</SelectItem>
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

        <TableCell className="p-1 whitespace-nowrap">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["PENDING", "COMPLETED", "PLANNED", "CANCELLED"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[s]}`} />
                    {STATUS_LABELS[s]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        <TableCell className="p-1 whitespace-nowrap">
          {isTransfer ? (
            <div className="flex items-center gap-1.5 text-sm px-2">
              <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{transaction.account?.name ?? "—"}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="truncate">{transaction.destinationAccount?.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {amexEnabled && accounts.find((a) => a.id === accountId)?.type === "CHECKING" && (
                <button
                  type="button"
                  onClick={handleAmexToggle}
                  aria-label={isAmex ? "AMEX activé" : "AMEX désactivé"}
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
          )}
        </TableCell>

        <TableCell className="p-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openEditDialog}
              aria-label="Éditer date et compte"
              title="Éditer date et compte"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              aria-label="Supprimer la transaction"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <BucketSelectionDialog
        open={bucketDialogOpen}
        buckets={pendingAccountChange?.buckets ?? []}
        selectedBucketId={selectedBucketForChange}
        onBucketChange={setSelectedBucketForChange}
        onConfirm={handleBucketChangeConfirm}
        onCancel={handleBucketChangeCancel}
      />

      <CancelTransactionDialog
        open={cancelDialogOpen}
        onOpenChange={handleCancelDialogClose}
        cancelNote={cancelNote}
        onNoteChange={setCancelNote}
        onConfirm={handleCancelConfirm}
        onClose={() => handleCancelDialogClose(false)}
      />

      <EditTransactionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        accounts={accounts}
        editDate={editDate}
        onDateChange={setEditDate}
        editRecurring={editRecurring}
        onRecurringChange={setEditRecurring}
        editMonth={editMonth}
        onMonthChange={setEditMonth}
        editAccountId={editAccountId}
        onAccountChange={handleEditAccountChange}
        editDestinationAccountId={editDestinationAccountId}
        onDestinationAccountChange={handleEditDestinationAccountChange}
        editBucketId={editBucketId}
        onBucketChange={setEditBucketId}
        onSave={handleEditSave}
      />
    </>
  );
}
