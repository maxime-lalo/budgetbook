"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseMonthParam, toMonthParam } from "@/lib/formatters";

export function useMonthNavigation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const monthParam = searchParams.get("month") ?? undefined;
  const { year, month } = useMemo(() => parseMonthParam(monthParam), [monthParam]);

  const navigateToMonth = useCallback(
    (newYear: number, newMonth: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", toMonthParam(newYear, newMonth));
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
