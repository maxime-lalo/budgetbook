import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return currencyFormatter.format(num === 0 ? 0 : num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy", { locale: fr });
}

export function formatMonthYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMMM yyyy", { locale: fr });
}

export function parseMonthParam(month?: string): { year: number; month: number } {
  if (!month) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const d = parse(month, "yyyy-MM", new Date());
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Compte courant",
  CREDIT_CARD: "Carte de crédit",
  SAVINGS: "Épargne",
  INVESTMENT: "Investissement",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  COMPLETED: "Réalisé",
  CANCELLED: "Annulé",
  PLANNED: "Prévu",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-orange-500",
  COMPLETED: "bg-green-500",
  PLANNED: "bg-purple-500",
  CANCELLED: "bg-red-500",
};

export const STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  PLANNED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

export const DEFAULT_COLOR = "#6b7280";

export const FILTER_ALL = "__all__";
export const FILTER_NONE = "__none__";
