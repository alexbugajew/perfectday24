// Opening-Hours-Filter fuer Kandidaten-Pools
// ============================================================================
// Estimiert die typische Zielzeit eines Slots und filtert Kandidaten die
// zu diesem Zeitpunkt geschlossen sind heraus.
//
// Fallback: wenn Filter alle Kandidaten wegschmeisst (duenne Daten oder
// zu strenger opening_hours_raw-Bestand), werden die ungefilterten
// Kandidaten zurueckgegeben — lieber schlechter Timing als leerer Slot.

import { berlinInstant, berlinToday, parseYmd } from "../berlin-time";
import { isOpenAt } from "../opening-hours";
import type { PlanMode, PlanningContext, ScoredLocation, SlotDefinition } from "../types";

// Typische Uhrzeit pro Slot-Kind. Wird ggf. durch planMode/dayStartMin verschoben.
const KIND_HOUR: Record<string, number> = {
  breakfast: 9,
  brunch: 11,
  lunch: 13,
  coffee: 15,
  activity: 15,
  culture: 15,
  sightseeing: 14,
  walk: 17,
  dinner: 19,
  nightlife: 22,
  bar: 21,
  anything: 15,
};

function slotTypicalHour(slot: SlotDefinition, mode: PlanMode, dayStartHour: number): number {
  const kindHour = KIND_HOUR[slot.kind] ?? 15;

  // planMode verschiebt das Zeitfenster:
  if (mode === "evening") {
    // Alle Slots liegen im Abend-Fenster (18-24 Uhr)
    if (slot.kind === "dinner" || slot.kind === "lunch") return 19;
    if (slot.kind === "walk" || slot.kind === "activity" || slot.kind === "culture") return 21;
    if (slot.kind === "nightlife") return 22;
    return Math.max(18, kindHour);
  }
  if (mode === "morning") {
    return Math.min(12, Math.max(dayStartHour, kindHour));
  }
  if (mode === "midday") {
    return Math.min(17, Math.max(11, kindHour));
  }
  // fullday
  return Math.max(dayStartHour, kindHour);
}

function slotTypicalDate(
  slot: SlotDefinition,
  mode: PlanMode,
  context: PlanningContext
): Date {
  const dayStartHour = context.dayStartMin ? Math.floor(context.dayStartMin / 60) : 10;
  const hour = slotTypicalHour(slot, mode, dayStartHour);

  // Wandzeit meint Europe/Berlin — nicht die Server-Zeitzone (Vercel = UTC).
  const ymd = parseYmd(context.planDate) ?? berlinToday();
  return berlinInstant(ymd, hour * 60);
}

/**
 * Filtert Kandidaten die zur typischen Slot-Zielzeit geschlossen sind.
 * Faellt zurueck auf die Original-Liste wenn Filter alles ausschliesst.
 */
export function filterByOpeningHours(
  candidates: ScoredLocation[],
  slot: SlotDefinition,
  mode: PlanMode,
  context: PlanningContext
): ScoredLocation[] {
  if (candidates.length === 0) return candidates;
  const at = slotTypicalDate(slot, mode, context);

  // Bufferminuten: geplanter Stop plus 30 Min Aktivitaet mindestens noch offen.
  const bufferMin = 30;
  const filtered = candidates.filter((c) =>
    isOpenAt(c.opening_hours_raw ?? null, at, { bufferMin })
  );

  // Wenn der Filter zu strikt war, lieber schlechter Timing als leerer Slot.
  if (filtered.length === 0) return candidates;
  return filtered;
}
