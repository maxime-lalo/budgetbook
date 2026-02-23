"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransfer, updateTransfer } from "../_actions/transfer-actions";
import { toast } from "sonner";
import { ArrowUpDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { ACCOUNT_TYPE_LABELS } from "@/lib/formatters";
import { type FormAccount, type FormCategory, type SerializedTransfer } from "@/lib/types";

export function TransferFormDialog({
  accounts,
  categories,
  year,
  month,
  transfer,
  open: controlledOpen,
  onOpenChange,
}: {
  accounts: FormAccount[];
  categories: FormCategory[];
  year: number;
  month: number;
  transfer?: SerializedTransfer;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!transfer;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const defaultCategoryId = transfer?.categoryId ?? findTransferCategory(categories) ?? "";

  const [accountId, setAccountId] = useState(transfer?.accountId ?? accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(transfer?.destinationAccountId ?? accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [status, setStatus] = useState<"PENDING" | "COMPLETED" | "CANCELLED" | "PRÉVUE">((transfer?.status as "PENDING" | "COMPLETED" | "CANCELLED" | "PRÉVUE") ?? "PENDING");
  const [dateValue, setDateValue] = useState(transfer?.date ? transfer.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
  const [bucketId, setBucketId] = useState(transfer?.bucketId ?? "");

  const handleOpenChange = useCallback((value: boolean) => {
    if (value && transfer) {
      setAccountId(transfer.accountId);
      setDestinationAccountId(transfer.destinationAccountId ?? accounts[1]?.id ?? "");
      setCategoryId(transfer.categoryId ?? "");
      setStatus(transfer.status as typeof status);
      setDateValue(transfer.date ? transfer.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
      setBucketId(transfer.bucketId ?? "");
    }
    if (value && !transfer) {
      setAccountId(accounts[0]?.id ?? "");
      setDestinationAccountId(accounts[1]?.id ?? "");
      setCategoryId(findTransferCategory(categories) ?? "");
      setStatus("PENDING");
      setDateValue(format(new Date(), "yyyy-MM-dd"));
      setBucketId("");
    }
    setOpen(value);
  }, [transfer, accounts, categories, setOpen]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const destinationAccount = accounts.find((a) => a.id === destinationAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const isSavingsType = (a?: FormAccount) => a && (a.type === "SAVINGS" || a.type === "INVESTMENT") && a.buckets.length > 0;
  const showBucket = isSavingsType(destinationAccount) || isSavingsType(selectedAccount);
  const bucketAccount = isSavingsType(destinationAccount) ? destinationAccount! : isSavingsType(selectedAccount) ? selectedAccount! : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      label: formData.get("label") as string,
      amount: Number(formData.get("amount")),
      date: dateValue ? new Date(dateValue) : null,
      month,
      year,
      status,
      note: (formData.get("note") as string) || null,
      accountId,
      categoryId,
      subCategoryId: (formData.get("subCategoryId") as string) || null,
      bucketId: bucketId || null,
      isAmex: false,
      recurring: false,
      destinationAccountId,
    };

    const result = isEdit
      ? await updateTransfer(transfer!.id, data)
      : await createTransfer(data);

    if ("error" in result && result.error) {
      const msg = Object.values(result.error).flat().join(", ");
      toast.error(msg || "Erreur de validation");
      return;
    }
    toast.success(isEdit ? "Virement modifié" : "Virement créé");
    setOpen(false);
  }

  return (
    <>
      {!isEdit && (
        <>
          <Button className="hidden sm:inline-flex" onClick={() => handleOpenChange(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau virement
          </Button>
          <Button
            className="sm:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg p-0"
            onClick={() => handleOpenChange(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Modifier le virement" : "Nouveau virement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                name="label"
                required
                defaultValue={transfer?.label ?? ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  defaultValue={transfer ? Math.abs(transfer.amount) : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Compte source</Label>
              <Select value={accountId} onValueChange={(v) => {
                setAccountId(v);
                if (v === destinationAccountId) {
                  const other = accounts.find((a) => a.id !== v);
                  setDestinationAccountId(other?.id ?? "");
                }
                if (!isSavingsType(accounts.find((a) => a.id === v)) && !isSavingsType(accounts.find((a) => a.id === destinationAccountId))) {
                  setBucketId("");
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 inline-block"
                          style={{ backgroundColor: a.color ?? "#6b7280" }}
                        />
                        {a.name}
                        <span className="text-muted-foreground text-xs">
                          ({ACCOUNT_TYPE_LABELS[a.type] ?? a.type})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  const prev = accountId;
                  setAccountId(destinationAccountId);
                  setDestinationAccountId(prev);
                  setBucketId("");
                }}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Compte destination</Label>
              <Select key={accountId} value={destinationAccountId} onValueChange={(v) => {
                setDestinationAccountId(v);
                const acct = accounts.find((a) => a.id === v);
                if (isSavingsType(acct)) {
                  setBucketId((prev) => {
                    const valid = acct!.buckets.some((b) => b.id === prev);
                    return valid ? prev : acct!.buckets[0]?.id ?? "";
                  });
                } else if (!isSavingsType(selectedAccount)) {
                  setBucketId("");
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== accountId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 inline-block"
                          style={{ backgroundColor: a.color ?? "#6b7280" }}
                        />
                        {a.name}
                        <span className="text-muted-foreground text-xs">
                          ({ACCOUNT_TYPE_LABELS[a.type] ?? a.type})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showBucket && bucketAccount && (
              <div className="space-y-2">
                <Label>Bucket</Label>
                <Select value={bucketId || bucketAccount.buckets[0]?.id} onValueChange={setBucketId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    {bucketAccount.buckets.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: c.color ?? "#6b7280" }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sous-catégorie</Label>
                <Select
                  name="subCategoryId"
                  defaultValue={transfer?.subCategoryId ?? undefined}
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

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="COMPLETED">Réalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                name="note"
                placeholder="Optionnel..."
                defaultValue={transfer?.note ?? ""}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{isEdit ? "Modifier" : "Créer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function findTransferCategory(categories: FormCategory[]): string | undefined {
  const keywords = ["virement", "épargne", "epargne", "transfert"];
  for (const cat of categories) {
    const lower = cat.name.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      return cat.id;
    }
  }
  return undefined;
}
