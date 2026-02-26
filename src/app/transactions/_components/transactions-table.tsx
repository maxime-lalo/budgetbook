"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
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
import { searchTransactionsAcrossMonths, swapTransactionOrder } from "../_actions/transaction-actions";
import { toast } from "sonner";
import { formatCurrency, STATUS_ORDER, FILTER_ALL } from "@/lib/formatters";
import { type SerializedTransaction, type FormAccount, type FormCategory } from "@/lib/types";

type SortColumn = "date" | "status" | "amount";
type SortDirection = "asc" | "desc";

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
    categoryId: initialCategory ?? FILTER_ALL,
    accountId: FILTER_ALL,
    status: FILTER_ALL,
    amountMin: "",
    amountMax: "",
    dateFrom: "",
    dateTo: "",
  });
  const [dateRangeResults, setDateRangeResults] = useState<SerializedTransaction[]>([]);
  const [isPending, startTransition] = useTransition();

  // Ordre local des transactions (sortOrder swappé côté client)
  const [orderMap, setOrderMap] = useState<Record<string, number>>({});
  const orderedTransactions = useMemo(() => {
    if (Object.keys(orderMap).length === 0) return transactions;
    return [...transactions]
      .map((t) => (t.id in orderMap ? { ...t, sortOrder: orderMap[t.id] } : t))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [transactions, orderMap]);

  const handleSwap = useCallback((idA: string, idB: string) => {
    const rowA = document.querySelector(`[data-transaction-id="${idA}"]`) as HTMLElement | null;
    const rowB = document.querySelector(`[data-transaction-id="${idB}"]`) as HTMLElement | null;

    const applySwap = () => {
      setOrderMap((prev) => {
        const list = Object.keys(prev).length > 0
          ? transactions.map((t) => ({ id: t.id, sortOrder: prev[t.id] ?? t.sortOrder }))
          : transactions.map((t) => ({ id: t.id, sortOrder: t.sortOrder }));
        const a = list.find((t) => t.id === idA);
        const b = list.find((t) => t.id === idB);
        if (!a || !b) return prev;
        return { ...prev, [idA]: b.sortOrder, [idB]: a.sortOrder };
      });
      swapTransactionOrder(idA, idB).then((result) => {
        if ("error" in result) toast.error("Erreur lors du changement d'ordre");
      });
    };

    if (rowA && rowB) {
      const deltaY = rowB.getBoundingClientRect().top - rowA.getBoundingClientRect().top;
      const duration = 200;
      const opts: KeyframeAnimationOptions = { duration, easing: "ease-in-out" };

      rowA.animate([{ transform: "translateY(0)" }, { transform: `translateY(${deltaY}px)` }], opts);
      rowB.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-deltaY}px)` }], opts);

      setTimeout(applySwap, duration);
    } else {
      applySwap();
    }
  }, [transactions]);

  const handleFilterChange = useCallback(
    (newFilters: TransactionFilterValues) => {
      setFilters(newFilters);

      const hasDateRange = newFilters.dateFrom || newFilters.dateTo;

      if (hasDateRange) {
        startTransition(async () => {
          const results = await searchTransactionsAcrossMonths(
            newFilters.search,
            {
              categoryId: newFilters.categoryId !== FILTER_ALL ? newFilters.categoryId : undefined,
              accountId: newFilters.accountId !== FILTER_ALL ? newFilters.accountId : undefined,
              status: newFilters.status !== FILTER_ALL ? newFilters.status : undefined,
              amountMin: newFilters.amountMin ? parseFloat(newFilters.amountMin) : undefined,
              amountMax: newFilters.amountMax ? parseFloat(newFilters.amountMax) : undefined,
              dateFrom: newFilters.dateFrom || undefined,
              dateTo: newFilters.dateTo || undefined,
            }
          );
          setDateRangeResults(results);
        });
      } else {
        setDateRangeResults([]);
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
  const filtered = orderedTransactions.filter((t) => {
    if (filters.categoryId !== FILTER_ALL && t.categoryId !== filters.categoryId) return false;
    if (filters.accountId !== FILTER_ALL && t.accountId !== filters.accountId) return false;
    if (filters.status !== FILTER_ALL && t.status !== filters.status) return false;
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
    if (filters.dateFrom && (!t.date || t.date < filters.dateFrom)) return false;
    if (filters.dateTo && (!t.date || t.date > filters.dateTo)) return false;
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

  if (orderedTransactions.length === 0 && budgetCarryOver === 0) {
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

  const isDateRangeActive = !!(filters.dateFrom || filters.dateTo);
  const showReorderArrows = sortColumn === null && !isDateRangeActive;

  const noFilterResults = filtered.length === 0 && (filters.categoryId !== FILTER_ALL || filters.search || filters.accountId !== FILTER_ALL || filters.status !== FILTER_ALL);

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
    transactionRows = filtered.map((t, index) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
        amexEnabled={amexEnabled}
        showReorderArrows={showReorderArrows}
        isFirst={index === 0}
        isLast={index === filtered.length - 1}
        onMoveUp={() => handleSwap(t.id, filtered[index - 1].id)}
        onMoveDown={() => handleSwap(t.id, filtered[index + 1].id)}
      />
    ));
  } else if (!separateRecurring) {
    const mixed = filtered;
    transactionRows = mixed.map((t, index) => (
      <EditableTransactionRow
        key={t.id}
        transaction={t}
        accounts={accounts}
        categories={categories}
        amexEnabled={amexEnabled}
        showReorderArrows={showReorderArrows}
        isFirst={index === 0}
        isLast={index === mixed.length - 1}
        onMoveUp={() => handleSwap(t.id, mixed[index - 1].id)}
        onMoveDown={() => handleSwap(t.id, mixed[index + 1].id)}
      />
    ));
  } else {
    // Pas de tri : layout par sections
    const recurring = filtered.filter((t) => t.recurring === true);
    const nonRecurring = filtered.filter((t) => t.recurring !== true);
    const hasBothSections = recurring.length > 0 && nonRecurring.length > 0;

    function handleRecurringKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setRecurringOpen((o) => !o);
      }
    }

    transactionRows = (
      <>
        {recurring.length > 0 && (
          <>
            <TableRow
              className="bg-muted/50 cursor-pointer select-none"
              onClick={() => setRecurringOpen((o) => !o)}
              role="button"
              tabIndex={0}
              onKeyDown={handleRecurringKeyDown}
              aria-label={`Récurrentes (${recurring.length}), ${recurringOpen ? "replier" : "déplier"}`}
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
              recurring.map((t, index) => (
                <EditableTransactionRow
                  key={t.id}
                  transaction={t}
                  accounts={accounts}
                  categories={categories}
                  amexEnabled={amexEnabled}
                  showReorderArrows={showReorderArrows}
                  isFirst={index === 0}
                  isLast={index === recurring.length - 1}
                  onMoveUp={() => handleSwap(t.id, recurring[index - 1].id)}
                  onMoveDown={() => handleSwap(t.id, recurring[index + 1].id)}
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
        {nonRecurring.map((t, index) => (
          <EditableTransactionRow
            key={t.id}
            transaction={t}
            accounts={accounts}
            categories={categories}
            amexEnabled={amexEnabled}
            showReorderArrows={showReorderArrows}
            isFirst={index === 0}
            isLast={index === nonRecurring.length - 1}
            onMoveUp={() => handleSwap(t.id, nonRecurring[index - 1].id)}
            onMoveDown={() => handleSwap(t.id, nonRecurring[index + 1].id)}
          />
        ))}
      </>
    );
  }

  let dateRangeRows: React.ReactNode = null;
  if (isDateRangeActive) {
    if (isPending) {
      dateRangeRows = (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
            Recherche en cours...
          </TableCell>
        </TableRow>
      );
    } else if (dateRangeResults.length === 0) {
      dateRangeRows = (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
            Aucun résultat trouvé pour cette période.
          </TableCell>
        </TableRow>
      );
    } else {
      const sorted = sortColumn ? [...dateRangeResults].sort(compareFn) : dateRangeResults;
      dateRangeRows = sorted.map((t) => (
        <EditableTransactionRow
          key={t.id}
          transaction={t}
          accounts={accounts}
          categories={categories}
          amexEnabled={amexEnabled}
        />
      ));
    }
  }

  return (
    <>
      <TransactionFilters
        categories={categories}
        accounts={accounts}
        initialCategory={initialCategory}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {!isDateRangeActive && (
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
            {isDateRangeActive ? (
              dateRangeRows
            ) : (
              <>
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
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
