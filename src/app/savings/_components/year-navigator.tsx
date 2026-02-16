"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

const START_YEAR = 2017;
const STORAGE_KEY = "selected-savings-year";

function getYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = START_YEAR; y <= currentYear; y++) {
    years.push(y);
  }
  return years;
}

function getStoredYear(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return Number(stored);
  // Fallback : déduire l'année du mois sélectionné sur la page transactions
  const monthParam = localStorage.getItem("selected-month");
  if (monthParam) {
    const parsed = parseInt(monthParam.split("-")[0], 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function storeYear(year: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(year));
}

export function YearNavigator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const yearParam = searchParams.get("year");
  const stored = getStoredYear();

  useEffect(() => {
    if (!yearParam && stored) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(stored));
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [yearParam, stored, searchParams, router, pathname]);

  const year = useMemo(() => {
    if (yearParam) return Number(yearParam);
    if (stored) return stored;
    return new Date().getFullYear();
  }, [yearParam, stored]);

  useEffect(() => {
    if (yearParam) {
      storeYear(Number(yearParam));
    }
  }, [yearParam]);

  const navigateToYear = useCallback(
    (newYear: number) => {
      storeYear(newYear);
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(newYear));
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;

  return (
    <div className="flex items-center gap-2">
      {!isCurrentYear && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateToYear(currentYear)}
        >
          Année courante
        </Button>
      )}
      <Button variant="outline" size="icon" onClick={() => navigateToYear(year - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select
        value={String(year)}
        onValueChange={(value) => navigateToYear(Number(value))}
      >
        <SelectTrigger size="sm" className="font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {getYears().map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" onClick={() => navigateToYear(year + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
