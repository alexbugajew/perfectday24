import type { PlannedStop } from "@/lib/planner";
import { formatPlannerTime } from "./helpers";

type DayBlockProps = {
  date: string | null; // "Sa., 10.10."
  stops: PlannedStop[];
  children: React.ReactNode;
};

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} Min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} Min`;
}

// Die Dauer kommt aus der geplanten Spanne, nicht aus der Summe der
// Stop-Dauern: Event-Anker beginnen mit Einlass-Vorlauf und enden mit der
// Quell-Endzeit, leere Slots bekommen Zeit ohne durationMin — eine Summe läge
// sichtbar neben den Uhrzeiten auf den Karten.
function planSpan(stops: PlannedStop[]) {
  let first: number | null = null;
  let last: number | null = null;
  let firstIso: string | null = null;
  let lastIso: string | null = null;
  for (const stop of stops) {
    const start = stop.scheduledStartAt ? Date.parse(stop.scheduledStartAt) : Number.NaN;
    const end = stop.scheduledEndAt ? Date.parse(stop.scheduledEndAt) : Number.NaN;
    if (Number.isFinite(start) && (first === null || start < first)) {
      first = start;
      firstIso = stop.scheduledStartAt ?? null;
    }
    if (Number.isFinite(end) && (last === null || end > last)) {
      last = end;
      lastIso = stop.scheduledEndAt ?? null;
    }
  }
  if (first === null || last === null || last <= first) return null;
  return {
    window: `${formatPlannerTime(firstIso)}–${formatPlannerTime(lastIso)}`,
    minutes: Math.round((last - first) / 60000),
  };
}

export default function DayBlock({ date, stops, children }: DayBlockProps) {
  const span = planSpan(stops);
  const fallbackMinutes = stops.reduce(
    (acc, stop) => acc + (stop.durationMin ?? 0) + (stop.travelMinFromPrev ?? 0),
    0
  );
  const filledStops = stops.filter((stop) => stop.item).length;

  return (
    <div className="my-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-[rgba(68,57,46,0.08)] pb-3">
        {date ? (
          <span className="rounded-lg bg-[var(--text-strong)] px-3 py-1 text-sm font-semibold text-white">{date}</span>
        ) : null}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--text-muted)]">
          <span>
            <span className="font-semibold text-[var(--text-strong)]">{filledStops}</span> Stops
          </span>
          {span ? (
            <span className="font-semibold tabular-nums text-[var(--text-strong)]">{span.window}</span>
          ) : null}
          <span>
            <span className="font-semibold text-[var(--text-strong)]">
              {formatDuration(span ? span.minutes : fallbackMinutes)}
            </span>{" "}
            Dauer
          </span>
        </div>
      </div>

      <ol className="ml-3 space-y-0 border-l-2 border-[rgba(68,57,46,0.14)]">{children}</ol>
    </div>
  );
}
