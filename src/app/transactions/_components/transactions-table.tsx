"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, CreditCard } from "lucide-react";
import { EditableTransactionRow } from "./editable-transaction-row";
import { NewTransactionRow } from "./new-transaction-row";
import { CopyRecurringButton } from "./copy-recurring-button";
import { CompleteAmexButton } from "./complete-amex-button";
import { formatCurrency } from "@/lib/formatters";

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
  destinationAccountId: string | null;
  account: { name: string; color: string | null };
  destinationAccount: { name: string; color: string | null } | null;
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

type SortColumn = "status" | "amount";
type SortDirection = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  COMPLETED: 0,
  PENDING: 1,
  CANCELLED: 2,
};

export function TransactionsTable({
  transactions,
  accounts,
  categories,
  budgetCarryOver,
  initialCategory,
  year,
  month,
  amexPendingCount,
  amexMonthlyTotal,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgetCarryOver: number;
  initialCategory?: string;
  year: number;
  month: number;
  amexPendingCount: number;
  amexMonthlyTotal: number;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory ?? "__all__");
  const [recurringOpen, setRecurringOpen] = useState(false);

  function toggleSort(column: SortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortColumn(null);
      setSortDirection("asc");
    }
  }

  // 1. Filtrer
  const filtered =
    categoryFilter !== "__all__"
      ? transactions.filter((t) => t.categoryId === categoryFilter)
      : transactions;

  // 2. Trier (si actif)
  function compareFn(a: Transaction, b: Transaction): number {
    const dir = sortDirection === "asc" ? 1 : -1;

    if (sortColumn === "status") {
      const aOrder = STATUS_ORDER[a.status] ?? 99;
      const bOrder = STATUS_ORDER[b.status] ?? 99;
      return dir * (aOrder - bOrder);
    }

    if (sortColumn === "amount") {
      return dir * (a.amount - b.amount);
    }

    return 0;
  }

  function SortableHeader({
    column,
    label,
    className,
  }: {
    column: SortColumn;
    label: string;
    className?: string;
  }) {
    const icon =
      sortColumn === column ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5" />
      );

    return (
      <TableHead className={className}>
        <button
          onClick={() => toggleSort(column)}
          className="flex items-center gap-1 hover:text-foreground"
        >
          {label}
          {icon}
        </button>
      </TableHead>
    );
  }

  if (transactions.length === 0 && budgetCarryOver === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucune transaction pour ce mois.
      </div>
    );
  }

  const carryOverRow = budgetCarryOver !== 0 && (
    <TableRow className="bg-muted/30">
      <TableCell className="py-2 text-sm italic text-muted-foreground">
        Report mois précédent
      </TableCell>
      <TableCell
        className={`py-2 text-sm font-medium ${
          budgetCarryOver >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        {formatCurrency(budgetCarryOver)}
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
    </TableRow>
  );

  const noFilterResults = filtered.length === 0 && categoryFilter !== "__all__";

  // Rendu des lignes de transactions
  let transactionRows: React.ReactNode;

  if (noFilterResults) {
    transactionRows = (
      <TableRow>
        <TableCell
          colSpan={6}
          className="text-center py-8 text-muted-foreground"
        >
          Aucune transaction pour cette catégorie.
        </TableCell>
      </TableRow>
    );
  } else if (sortColumn) {
    // Tri actif : liste plate, pas de sections
    const sorted = [...filtered].sort(compareFn);
    transactionRows = sorted.map((t) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
      />
    ));
  } else {
    // Pas de tri : layout par sections
    const dateless = filtered.filter((t) => t.date === null);
    const dated = filtered.filter((t) => t.date !== null);
    const hasBothSections = dateless.length > 0 && dated.length > 0;

    transactionRows = (
      <>
        {dateless.length > 0 && (
          <>
            <TableRow
              className="bg-muted/50 cursor-pointer select-none"
              onClick={() => setRecurringOpen((o) => !o)}
            >
              <TableCell
                colSpan={6}
                className="py-1.5 px-4 text-sm font-medium text-muted-foreground"
              >
                <div className="flex items-center gap-1">
                  {recurringOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Récurrentes ({dateless.length})
                </div>
              </TableCell>
            </TableRow>
            {recurringOpen &&
              dateless.map((t) => (
                <EditableTransactionRow
                  key={t.id}
                  transaction={t}
                  accounts={accounts}
                  categories={categories}
                />
              ))}
          </>
        )}
        {hasBothSections && (
          <TableRow>
            <TableCell
              colSpan={6}
              className="bg-muted/50 py-2 px-4 text-sm font-medium text-muted-foreground"
            >
              Transactions ({dated.length})
            </TableCell>
          </TableRow>
        )}
        {dated.map((t) => (
          <EditableTransactionRow
            key={t.id}
            transaction={t}
            accounts={accounts}
            categories={categories}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les catégories</SelectItem>
            {[...categories].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CopyRecurringButton year={year} month={month} />
        {amexPendingCount > 0 && (
          <CompleteAmexButton year={year} month={month} pendingCount={amexPendingCount} />
        )}
        {amexMonthlyTotal !== 0 && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground border rounded-md h-9 px-3">
            <CreditCard className="h-4 w-4" />
            <span>AMEX :</span>
            <span className={`font-medium ${amexMonthlyTotal < 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(amexMonthlyTotal)}
            </span>
          </div>
        )}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <SortableHeader
                column="amount"
                label="Montant"
                className="w-[100px]"
              />
              <TableHead>Catégorie</TableHead>
              <SortableHeader column="status" label="Statut" />
              <TableHead>Compte</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carryOverRow}
            {transactionRows}
            <NewTransactionRow
              accounts={accounts}
              categories={categories}
              year={year}
              month={month}
            />
          </TableBody>
        </Table>
      </div>
    </>
  );
}
