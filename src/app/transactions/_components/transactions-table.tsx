"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, CreditCard } from "lucide-react";
import { EditableTransactionRow } from "./editable-transaction-row";
import { NewTransactionRow } from "./new-transaction-row";
import { CopyRecurringButton } from "./copy-recurring-button";
import { CompleteAmexButton } from "./complete-amex-button";
import { TransactionFilters, type TransactionFilterValues } from "./transaction-filters";
import { CrossMonthResults } from "./cross-month-results";
import { searchTransactionsAcrossMonths } from "../_actions/transaction-actions";
import { formatCurrency } from "@/lib/formatters";
import { type SerializedTransaction, type FormAccount, type FormCategory } from "@/lib/types";

type SortColumn = "date" | "status" | "amount";
type SortDirection = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  COMPLETED: 0,
  PENDING: 1,
  PRÉVUE: 2,
  CANCELLED: 3,
};

type CrossMonthResult = {
  id: string;
  label: string;
  amount: number;
  date: string | null;
  month: number;
  year: number;
  status: string;
  category: { name: string; color: string | null } | null;
  account: { name: string } | null;
};

function SortableHeader({
  column,
  label,
  className,
  sortColumn,
  sortDirection,
  onToggleSort,
}: {
  column: SortColumn;
  label: string;
  className?: string;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onToggleSort: (column: SortColumn) => void;
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
        onClick={() => onToggleSort(column)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {icon}
      </button>
    </TableHead>
  );
}

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
  amexEnabled = true,
  separateRecurring = true,
  hideCopyRecurring = false,
  flatLayout = false,
  defaultAccountId,
  defaultCategoryId,
}: {
  transactions: SerializedTransaction[];
  accounts: FormAccount[];
  categories: FormCategory[];
  budgetCarryOver: number;
  initialCategory?: string;
  year: number;
  month: number;
  amexPendingCount: number;
  amexMonthlyTotal: number;
  amexEnabled?: boolean;
  separateRecurring?: boolean;
  hideCopyRecurring?: boolean;
  flatLayout?: boolean;
  defaultAccountId?: string;
  defaultCategoryId?: string;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilterValues>({
    search: "",
    categoryId: initialCategory ?? "__all__",
    accountId: "__all__",
    status: "__all__",
    amountMin: "",
    amountMax: "",
    crossMonth: false,
  });
  const [crossMonthResults, setCrossMonthResults] = useState<CrossMonthResult[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = useCallback(
    (newFilters: TransactionFilterValues) => {
      setFilters(newFilters);

      // Trigger cross-month search
      if (newFilters.crossMonth && newFilters.search.trim()) {
        startTransition(async () => {
          const results = await searchTransactionsAcrossMonths(
            newFilters.search,
            {
              categoryId: newFilters.categoryId !== "__all__" ? newFilters.categoryId : undefined,
              accountId: newFilters.accountId !== "__all__" ? newFilters.accountId : undefined,
              status: newFilters.status !== "__all__" ? newFilters.status : undefined,
              amountMin: newFilters.amountMin ? parseFloat(newFilters.amountMin) : undefined,
              amountMax: newFilters.amountMax ? parseFloat(newFilters.amountMax) : undefined,
            }
          );
          setCrossMonthResults(results);
        });
      } else if (!newFilters.crossMonth || !newFilters.search.trim()) {
        setCrossMonthResults([]);
      }
    },
    []
  );

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

  // Apply all filters
  const filtered = transactions.filter((t) => {
    if (filters.categoryId !== "__all__" && t.categoryId !== filters.categoryId) return false;
    if (filters.accountId !== "__all__" && t.accountId !== filters.accountId) return false;
    if (filters.status !== "__all__" && t.status !== filters.status) return false;
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min) && t.amount < min) return false;
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max) && t.amount > max) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchLabel = t.label.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchAmount = formatCurrency(t.amount).includes(q);
      if (!matchLabel && !matchNote && !matchAmount) return false;
    }
    return true;
  });

  // Sort
  function compareFn(a: SerializedTransaction, b: SerializedTransaction): number {
    const dir = sortDirection === "asc" ? 1 : -1;

    if (sortColumn === "date") {
      const aDate = a.date ?? "";
      const bDate = b.date ?? "";
      return dir * aDate.localeCompare(bDate);
    }

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
      <TableCell />
      <TableCell
        className={`py-2 text-sm font-medium text-center ${
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

  const noFilterResults = filtered.length === 0 && (filters.categoryId !== "__all__" || filters.search || filters.accountId !== "__all__" || filters.status !== "__all__");

  // Render transaction rows
  let transactionRows: React.ReactNode;

  if (noFilterResults) {
    transactionRows = (
      <TableRow>
        <TableCell
          colSpan={7}
          className="text-center py-8 text-muted-foreground"
        >
          Aucune transaction ne correspond aux filtres.
        </TableCell>
      </TableRow>
    );
  } else if (sortColumn) {
    const sorted = [...filtered].sort(compareFn);
    transactionRows = sorted.map((t) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
        amexEnabled={amexEnabled}
      />
    ));
  } else if (flatLayout) {
    transactionRows = filtered.map((t) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
        amexEnabled={amexEnabled}
      />
    ));
  } else if (!separateRecurring) {
    transactionRows = filtered.map((t) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
        amexEnabled={amexEnabled}
      />
    ));
  } else {
    // Pas de tri : layout par sections
    const recurring = filtered.filter((t) => t.recurring === true);
    const nonRecurring = filtered.filter((t) => t.recurring !== true);
    const hasBothSections = recurring.length > 0 && nonRecurring.length > 0;

    transactionRows = (
      <>
        {recurring.length > 0 && (
          <>
            <TableRow
              className="bg-muted/50 cursor-pointer select-none"
              onClick={() => setRecurringOpen((o) => !o)}
            >
              <TableCell
                colSpan={7}
                className="py-1.5 px-4 text-sm font-medium text-muted-foreground"
              >
                <div className="flex items-center gap-1">
                  {recurringOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Récurrentes ({recurring.length})
                </div>
              </TableCell>
            </TableRow>
            {recurringOpen &&
              recurring.map((t) => (
                <EditableTransactionRow
                  key={t.id}
                  transaction={t}
                  accounts={accounts}
                  categories={categories}
                  amexEnabled={amexEnabled}
                />
              ))}
          </>
        )}
        {hasBothSections && (
          <TableRow>
            <TableCell
              colSpan={7}
              className="bg-muted/50 py-2 px-4 text-sm font-medium text-muted-foreground"
            >
              Transactions ({nonRecurring.length})
            </TableCell>
          </TableRow>
        )}
        {nonRecurring.map((t) => (
          <EditableTransactionRow
            key={t.id}
            transaction={t}
            accounts={accounts}
            categories={categories}
            amexEnabled={amexEnabled}
          />
        ))}
      </>
    );
  }

  const showCrossMonth = filters.crossMonth && filters.search.trim();

  return (
    <>
      <TransactionFilters
        categories={categories}
        accounts={accounts}
        initialCategory={initialCategory}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2">
        {!hideCopyRecurring && <CopyRecurringButton year={year} month={month} />}
        {amexEnabled && amexPendingCount > 0 && (
          <CompleteAmexButton year={year} month={month} pendingCount={amexPendingCount} />
        )}
        {amexEnabled && amexMonthlyTotal !== 0 && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground border rounded-md h-9 px-3">
            <CreditCard className="h-4 w-4" />
            <span>AMEX</span>
            <span className={`font-medium ${amexMonthlyTotal < 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(amexMonthlyTotal)}
            </span>
          </div>
        )}
      </div>

      {showCrossMonth && (
        <CrossMonthResults results={crossMonthResults} loading={isPending} />
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <SortableHeader
                column="date"
                label="Date"
                className="w-[130px]"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onToggleSort={toggleSort}
              />
              <SortableHeader
                column="amount"
                label="Montant"
                className="w-[100px]"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onToggleSort={toggleSort}
              />
              <TableHead>Catégorie</TableHead>
              <SortableHeader
                column="status"
                label="Statut"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onToggleSort={toggleSort}
              />
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
              amexEnabled={amexEnabled}
              defaultAccountId={defaultAccountId}
              defaultCategoryId={defaultCategoryId}
            />
          </TableBody>
        </Table>
      </div>
    </>
  );
}
