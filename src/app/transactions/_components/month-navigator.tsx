"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMonthNavigation } from "@/lib/hooks/use-month-navigation";
import { formatMonthYear, toMonthParam } from "@/lib/formatters";

export function MonthNavigator() {
  const { year, month, previousMonth, nextMonth } = useMonthNavigation();
  const displayDate = new Date(year, month - 1, 1);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={previousMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-lg font-semibold min-w-[180px] text-center capitalize">
        {formatMonthYear(displayDate)}
      </span>
      <Button variant="outline" size="icon" onClick={nextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
