import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";

type TotalsBarProps = {
  real: number;
  pending: number;
  forecast: number;
  budgetCarryOver: number;
};

export function TotalsBar({ real, pending, forecast, budgetCarryOver }: TotalsBarProps) {
  const adjustedReal = real + budgetCarryOver;
  const adjustedForecast = forecast + budgetCarryOver;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total sur compte</div>
          <div className={`text-2xl font-bold ${adjustedReal >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(adjustedReal)}
          </div>
          {budgetCarryOver !== 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              dont report : <span className={budgetCarryOver >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(budgetCarryOver)}</span>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Reste à passer</div>
          <div className={`text-2xl font-bold ${pending >= 0 ? "text-blue-600" : "text-orange-600"}`}>
            {formatCurrency(pending)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total réel</div>
          <div className={`text-2xl font-bold ${adjustedForecast >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(adjustedForecast)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
