/**
 * Barre de progression avec couleur conditionnelle et pourcentage affiché.
 *
 * variant="budget" : vert → jaune → rouge (dépense qui monte = danger)
 * variant="goal"   : rouge → jaune → vert (progression vers un objectif = positif)
 */
export function ProgressBar({
  value,
  max,
  variant = "budget",
}: {
  value: number;
  max: number;
  variant?: "budget" | "goal";
}) {
  const progress = max > 0 ? Math.min((value / max) * 100, 100) : value > 0 ? 100 : 0;
  const ratio = max > 0 ? value / max : value > 0 ? 1 : 0;

  let colorClass: string;
  if (variant === "budget") {
    if (max === 0 && value === 0) colorClass = "bg-muted";
    else if (ratio >= 1) colorClass = "bg-red-500";
    else if (ratio >= 0.75) colorClass = "bg-yellow-500";
    else colorClass = "bg-green-500";
  } else {
    if (ratio >= 0.75) colorClass = "bg-green-500";
    else if (ratio >= 0.5) colorClass = "bg-yellow-500";
    else colorClass = "bg-red-500";
  }

  return (
    <div className="relative h-5 w-full overflow-hidden rounded-full bg-primary/20">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
        {Math.round(progress)}%
      </span>
    </div>
  );
}
