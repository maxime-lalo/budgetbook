"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

type HeatmapData = {
  categories: { id: string; name: string; color: string | null }[];
  data: Record<string, Record<number, number>>;
  subCategoryData?: Record<string, {
    subCategories: { id: string; name: string }[];
    data: Record<string, Record<number, number>>;
  }>;
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (data.categories.length === 0) {
    return null;
  }

  const toggleExpand = (categoryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandableIds = data.categories
    .filter((cat) => data.subCategoryData?.[cat.id]?.subCategories.length)
    .map((cat) => cat.id);
  const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id));

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(expandableIds));
    }
  };

  // Compute max per category for opacity scaling
  const maxPerCategory = new Map<string, number>();
  for (const cat of data.categories) {
    const months = data.data[cat.id] ?? {};
    const max = Math.max(...Object.values(months), 0);
    maxPerCategory.set(cat.id, max);
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Dépenses par catégorie — {year}</CardTitle>
        {expandableIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs gap-1.5">
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allExpanded ? "Tout replier" : "Tout déplier"}
          </Button>
        )}
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
                const subData = data.subCategoryData?.[cat.id];
                const hasSubCategories = subData && subData.subCategories.length > 0;
                const isExpanded = expanded.has(cat.id);

                return (
                  <>
                    <tr
                      key={cat.id}
                      className={`border-b last:border-0 ${hasSubCategories ? "cursor-pointer hover:bg-muted/40" : ""}`}
                      onClick={hasSubCategories ? () => toggleExpand(cat.id) : undefined}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {hasSubCategories ? (
                            isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="w-3.5 shrink-0" />
                          )}
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
                    {isExpanded && subData && subData.subCategories.map((sub) => {
                      const subMonthData = subData.data[sub.id] ?? {};
                      const subMax = Math.max(...Object.values(subMonthData), 0);
                      const subTotal = Object.values(subMonthData).reduce((sum, v) => sum + v, 0);

                      return (
                        <tr key={`${cat.id}-${sub.id}`} className="border-b last:border-0 bg-muted/30">
                          <td className="p-2 pl-10">
                            <span className="text-[11px] text-muted-foreground truncate">{sub.name}</span>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => {
                            const amount = subMonthData[i + 1] ?? 0;
                            const rawOpacity = subMax > 0 ? Math.max(0.1, Math.min(1, amount / subMax)) : 0;
                            const opacity = rawOpacity * 0.7;
                            const textDark = opacity > 0.45;

                            return (
                              <td key={i} className="p-1">
                                {amount > 0 ? (
                                  <div
                                    className="rounded px-1 py-1.5 text-center tabular-nums text-[11px]"
                                    style={{
                                      backgroundColor: hexToRgba(cat.color ?? "#6b7280", opacity),
                                      color: textDark ? "white" : undefined,
                                    }}
                                  >
                                    {formatCurrency(amount)}
                                  </div>
                                ) : (
                                  <div className="text-center text-muted-foreground/20 py-1.5 text-[11px]">–</div>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-2 text-right tabular-nums text-[11px] text-muted-foreground">
                            {formatCurrency(subTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
