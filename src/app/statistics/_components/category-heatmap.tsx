"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

type HeatmapData = {
  categories: { id: string; name: string; color: string | null }[];
  data: Record<string, Record<number, number>>;
};

function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2024, i).toLocaleDateString("fr-FR", { month: "short" })
);

export function CategoryHeatmap({ data, year }: { data: HeatmapData; year: number }) {
  if (data.categories.length === 0) {
    return null;
  }

  // Compute max per category for opacity scaling
  const maxPerCategory = new Map<string, number>();
  for (const cat of data.categories) {
    const months = data.data[cat.id] ?? {};
    const max = Math.max(...Object.values(months), 0);
    maxPerCategory.set(cat.id, max);
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Dépenses par catégorie — {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium min-w-[120px]">Catégorie</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className="text-center p-1 font-medium min-w-[70px] capitalize">
                    {m}
                  </th>
                ))}
                <th className="text-right p-2 font-medium min-w-[80px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat) => {
                const monthData = data.data[cat.id] ?? {};
                const maxVal = maxPerCategory.get(cat.id) ?? 0;
                const total = Object.values(monthData).reduce((sum, v) => sum + v, 0);

                return (
                  <tr key={cat.id} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color ?? "#6b7280" }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const amount = monthData[i + 1] ?? 0;
                      const opacity = maxVal > 0 ? Math.max(0.1, Math.min(1, amount / maxVal)) : 0;
                      const textDark = opacity > 0.6;

                      return (
                        <td key={i} className="p-1">
                          {amount > 0 ? (
                            <div
                              className="rounded px-1 py-1.5 text-center tabular-nums"
                              style={{
                                backgroundColor: hexToRgba(cat.color ?? "#6b7280", opacity),
                                color: textDark ? "white" : undefined,
                              }}
                            >
                              {formatCurrency(amount)}
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground/30 py-1.5">–</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right tabular-nums font-medium">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
