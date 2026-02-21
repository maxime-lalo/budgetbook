"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TransactionFilterValues = {
  search: string;
  categoryId: string;
  accountId: string;
  status: string;
  amountMin: string;
  amountMax: string;
  crossMonth: boolean;
};

type Category = {
  id: string;
  name: string;
  color: string | null;
  subCategories: { id: string; name: string }[];
};

type Account = {
  id: string;
  name: string;
  type: string;
};

export function TransactionFilters({
  categories,
  accounts,
  filters,
  onFilterChange,
}: {
  categories: Category[];
  accounts: Account[];
  initialCategory?: string;
  filters: TransactionFilterValues;
  onFilterChange: (filters: TransactionFilterValues) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const updateFilter = useCallback(
    (key: keyof TransactionFilterValues, value: string | boolean) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange]
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filters.categoryId} onValueChange={(v) => updateFilter("categoryId", v)}>
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
        <Select value={filters.accountId} onValueChange={(v) => updateFilter("accountId", v)}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Tous les comptes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les comptes</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les statuts</SelectItem>
            <SelectItem value="PENDING">En attente</SelectItem>
            <SelectItem value="COMPLETED">Réalisé</SelectItem>
            <SelectItem value="CANCELLED">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          Filtres avancés
          {showAdvanced ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
        </Button>
        {filters.crossMonth && filters.search && (
          <span className="text-xs text-muted-foreground">Recherche tous mois</span>
        )}
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input
            type="number"
            placeholder="Montant min"
            value={filters.amountMin}
            onChange={(e) => updateFilter("amountMin", e.target.value)}
            className="h-9 text-sm"
          />
          <Input
            type="number"
            placeholder="Montant max"
            value={filters.amountMax}
            onChange={(e) => updateFilter("amountMax", e.target.value)}
            className="h-9 text-sm"
          />
          <label className="flex items-center gap-2 text-sm col-span-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.crossMonth}
              onChange={(e) => updateFilter("crossMonth", e.target.checked)}
              className="rounded"
            />
            Rechercher tous les mois
          </label>
        </div>
      )}
    </div>
  );
}
