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
    <div className="grid gap-2 grid-cols-3">
      <Card className="py-2">
        <CardContent className="px-3 py-0 flex flex-col justify-between h-full">
          <div className="text-xs text-muted-foreground">Total sur compte</div>
          <div className={`text-lg font-bold leading-tight ${adjustedReal >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(adjustedReal)}
          </div>
        </CardContent>
      </Card>
      <Card className="py-2">
        <CardContent className="px-3 py-0 flex flex-col justify-between h-full">
          <div className="text-xs text-muted-foreground">Reste à passer</div>
          <div className={`text-lg font-bold leading-tight ${pending >= 0 ? "text-blue-600" : "text-orange-600"}`}>
            {formatCurrency(pending)}
          </div>
        </CardContent>
      </Card>
      <Card className="py-2">
        <CardContent className="px-3 py-0 flex flex-col justify-between h-full">
          <div className="text-xs text-muted-foreground">Total réel</div>
          <div className={`text-lg font-bold leading-tight ${adjustedForecast >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(adjustedForecast)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
