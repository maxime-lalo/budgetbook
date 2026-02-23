"use client";

import { useState, useRef } from "react";
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
import { Check, CreditCard } from "lucide-react";
import { STATUS_LABELS } from "@/lib/formatters";
import { createTransaction } from "../_actions/transaction-actions";
import { toast } from "sonner";

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

export function NewTransactionRow({
  accounts,
  categories,
  year,
  month,
  amexEnabled = true,
  defaultAccountId,
  defaultCategoryId,
}: {
  accounts: Account[];
  categories: Category[];
  year: number;
  month: number;
  amexEnabled?: boolean;
  defaultAccountId?: string;
  defaultCategoryId?: string;
}) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [isAmex, setIsAmex] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const canSubmit =
    label.trim() !== "" &&
    amount !== "" &&
    Number(amount) !== 0 &&
    !isNaN(Number(amount)) &&
    categoryId !== "";

  function resetFields() {
    setLabel("");
    setDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setCategoryId(defaultCategoryId ?? "");
    setSubCategoryId("");
    setStatus("PENDING");
    setAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
    setIsAmex(false);
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);

    const result = await createTransaction({
      label: label.trim(),
      amount: Number(amount),
      date: date || new Date().toISOString().split("T")[0],
      month,
      year,
      status,
      note: null,
      accountId,
      categoryId,
      subCategoryId: subCategoryId || null,
      bucketId: null,
      isAmex,
      destinationAccountId: null,
    });

    setIsSubmitting(false);

    if (result.error) {
      toast.error("Erreur lors de la création");
      return;
    }

    toast.success("Transaction créée");
    resetFields();
    setTimeout(() => labelRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setSubCategoryId("");
  }

  function handleAccountChange(value: string) {
    setAccountId(value);
    const newAccount = accounts.find((a) => a.id === value);
    if (newAccount?.type !== "CHECKING") {
      setIsAmex(false);
    }
  }

  return (
    <TableRow className="border-t border-dashed border-muted-foreground/30 bg-muted/20">
      {/* Libellé */}
      <TableCell className="p-1">
        <Input
          ref={labelRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nouveau..."
          className="h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input"
        />
      </TableCell>

      {/* Date */}
      <TableCell className="p-1 whitespace-nowrap text-center">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm text-center border-transparent bg-transparent hover:border-input focus:border-input w-[130px] text-muted-foreground"
        />
      </TableCell>

      {/* Montant */}
      <TableCell className="p-1 whitespace-nowrap">
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className={`h-8 text-sm text-center border-transparent bg-transparent hover:border-input focus:border-input w-full font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            amount === "" ? "" : Number(amount) < 0 ? "text-red-600" : "text-green-600"
          }`}
        />
      </TableCell>

      {/* Catégorie + Sous-catégorie */}
      <TableCell className="p-1 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Select value={categoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger className={`w-full h-8 text-sm bg-transparent hover:border-input focus:border-input ${!categoryId ? "border-dashed border-muted-foreground/40" : "border-transparent"}`}>
              <SelectValue placeholder="Catégorie" />
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
            <Select value={subCategoryId || "__none__"} onValueChange={(v) => setSubCategoryId(v === "__none__" ? "" : v)}>
              <SelectTrigger className={`w-full h-8 text-sm bg-transparent hover:border-input focus:border-input ${!subCategoryId ? "border-orange-500" : "border-transparent"}`}>
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
        <Select value={status} onValueChange={setStatus}>
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
            <SelectItem value="PRÉVUE">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0 bg-purple-500" />
                {STATUS_LABELS.PRÉVUE}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Compte */}
      <TableCell className="p-1 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {amexEnabled && selectedAccount?.type === "CHECKING" && (
            <button
              type="button"
              onClick={() => setIsAmex(!isAmex)}
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

      {/* Actions */}
      <TableCell className="p-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700 disabled:opacity-30"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            title="Créer la transaction"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
