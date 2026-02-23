"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type FormAccount } from "@/lib/types";

export function StatisticsFilters({
  accounts,
  currentYear,
  currentAccountId,
}: {
  accounts: FormAccount[];
  currentYear: number;
  currentAccountId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="flex items-center gap-4">
      <Select value={currentYear.toString()} onValueChange={(v) => updateParam("year", v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentAccountId ?? "all"} onValueChange={(v) => updateParam("account", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tous les comptes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les comptes</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
