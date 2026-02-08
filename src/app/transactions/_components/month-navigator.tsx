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
import { useMonthNavigation } from "@/lib/hooks/use-month-navigation";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const START_YEAR = 2017;

function getYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = START_YEAR; y <= currentYear; y++) {
    years.push(y);
  }
  return years;
}

export function MonthNavigator() {
  const { year, month, previousMonth, nextMonth, navigateToMonth } =
    useMonthNavigation();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={previousMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select
        value={String(month)}
        onValueChange={(value) => navigateToMonth(year, Number(value))}
      >
        <SelectTrigger size="sm" className="font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, index) => (
            <SelectItem key={index + 1} value={String(index + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(year)}
        onValueChange={(value) => navigateToMonth(Number(value), month)}
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
      <Button variant="outline" size="icon" onClick={nextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
