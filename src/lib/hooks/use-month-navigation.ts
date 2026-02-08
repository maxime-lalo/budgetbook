"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { parseMonthParam, toMonthParam } from "@/lib/formatters";

const STORAGE_KEY = "selected-month";

function getStoredMonth(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function storeMonth(param: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, param);
}

export function useMonthNavigation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const monthParam = searchParams.get("month");
  const stored = getStoredMonth();

  // Si pas de ?month= dans l'URL mais un mois stocké, redirect
  useEffect(() => {
    if (!monthParam && stored) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", stored);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [monthParam, stored, searchParams, router, pathname]);

  const effective = monthParam ?? stored ?? undefined;
  const { year, month } = useMemo(() => parseMonthParam(effective), [effective]);

  // Persister dans localStorage quand le param URL change
  useEffect(() => {
    if (monthParam) {
      storeMonth(monthParam);
    }
  }, [monthParam]);

  const navigateToMonth = useCallback(
    (newYear: number, newMonth: number) => {
      const param = toMonthParam(newYear, newMonth);
      storeMonth(param);
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", param);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const previousMonth = useCallback(() => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    navigateToMonth(newYear, newMonth);
  }, [month, year, navigateToMonth]);

  const nextMonth = useCallback(() => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    navigateToMonth(newYear, newMonth);
  }, [month, year, navigateToMonth]);

  return { year, month, monthParam: toMonthParam(year, month), previousMonth, nextMonth, navigateToMonth };
}
