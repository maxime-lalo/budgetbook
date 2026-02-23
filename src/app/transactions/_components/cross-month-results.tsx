"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, toMonthParam } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";

type SearchResult = {
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

export function CrossMonthResults({
  results,
  loading,
}: {
  results: SearchResult[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-md border p-4 space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Recherche en cours...</div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">Aucun résultat trouvé sur l{"'"}ensemble des mois.</p>
      </div>
    );
  }

  const monthLabels = (year: number, month: number) => {
    const d = new Date(year, month - 1);
    return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">Libellé</th>
            <th className="text-right p-2 font-medium">Montant</th>
            <th className="text-left p-2 font-medium">Catégorie</th>
            <th className="text-left p-2 font-medium">Compte</th>
            <th className="text-left p-2 font-medium">Mois</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-2 max-w-[200px] truncate">{r.label}</td>
              <td className={`p-2 text-right tabular-nums font-medium ${r.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(r.amount)}
              </td>
              <td className="p-2">
                {r.category && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{ borderColor: r.category.color ?? undefined, color: r.category.color ?? undefined }}
                  >
                    {r.category.name}
                  </Badge>
                )}
              </td>
              <td className="p-2 text-muted-foreground">{r.account?.name ?? "—"}</td>
              <td className="p-2">
                <Link
                  href={`/transactions?month=${toMonthParam(r.year, r.month)}`}
                  className="text-primary hover:underline"
                >
                  {monthLabels(r.year, r.month)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
