// AI-basierter Tagesplaner (Phase 1 MVP)
// =====================================
// Function-Calling-Loop mit gpt-4o-mini:
// 1. User-Prompt + Stadt + Datum kommen rein
// 2. LLM ruft Tools (find_food/culture/activity/nightlife/event) auf
// 3. LLM bekommt die DB-Kandidaten zurück, baut Stop-Plan mit echten IDs
// 4. Server resolvet IDs zu echten Locations, mapped auf PlannedStop[]
//
// Output kompatibel mit dem Stop-Card-Format aus TimelineStop.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  AI_PLANNER_TOOLS,
  callTool,
  type AiToolContext,
  type ToolName,
  type AiCandidate,
} from "@/lib/ai-planner/tools";
import { createClient } from "@supabase/supabase-js";
import { getUserPremiumStatus, FREE_AI_PLANS_PER_MONTH } from "@/lib/premium/limits";
import { isOpenAt } from "@/lib/planner/opening-hours";
import { normalizePlannerEventTitle } from "@/lib/planner/events";
import {
  berlinInstant,
  berlinMinutesOfDay,
  berlinParts,
  berlinToday,
  parseYmd,
  type BerlinYmd,
} from "@/lib/planner/berlin-time";
import {
  DEFAULT_FAMILY_AGE_BAND,
  familyAgeBandShortLabel,
  familyEarliestEventStartMin,
  familyTimeLimits,
  familyTimeRuleText,
  formatClockMinutes,
  resolveFamilyAgeBand,
  type FamilyTimeLimits,
} from "@/lib/planner/family-age";
import type { FamilyAgeBand, PlanMode } from "@/lib/planner/types";
import { getRequestUserId } from "@/lib/security/session";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type AiStopPlan = {
  location_id: string;
  label: string; // z.B. "Aperitif", "Dinner", "Hauptmoment"
  hint?: string;
  scheduled_start_at?: string | null; // ISO
  duration_min?: number | null;
  source?: "location" | "event";
};

type AiPlanResult = {
  summary: string;
  stops: AiStopPlan[];
};

type ResolvedStop = {
  index: number;
  label: string;
  hint: string;
  itemId: string;
  itemName: string;
  itemType: string;
  itemCategory: string | null;
  lat: number | null;
  lng: number | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  durationMin: number | null;
  source: "location" | "event";
  openingHoursRaw?: string | null;
};

const SYSTEM_PROMPT = `Du planst Tagesabläufe für PerfectDay24 in deutschen Städten.

Vorgehen:
1. Lies User-Wunsch + alle Constraints (Stadt, Datum, Anlass, Startpunkt, Interessen, gewünschte Stop-Anzahl, Budget).
2. Wenn ein Startpunkt mit Koordinaten gegeben ist, übergib bei JEDEM Tool-Call nearLat/nearLng und maxKm=5 — du bekommst dann nahe Kandidaten zurück.
3. Wenn der User ein Event/Konzert/Show erwähnt ODER eine eindeutige Event-Affinität signalisiert, IMMER zuerst find_event aufrufen — Events sind feste Anker.
4. Tool-Returns enthalten:
   - id: UUID — NUR DIESEN als location_id verwenden. NIEMALS den Namen, NIEMALS einen anderen String.
   - score (0-100): höher = besser. Bevorzuge Kandidaten mit score >= 60.
   - tags: curated Tags (z.B. "romantic", "kid-friendly", "live-music"). Match gegen Anlass.
   - distance_km: Entfernung vom Startpunkt. Bevorzuge < 3 km wenn vorhanden.
5. Wähle EXAKT so viele Stops wie unter "Gewünschte Stops" angegeben. Wenn nichts angegeben: 4.
6. Wenn du genug Kandidaten gesammelt hast, ruf das Tool **build_final_plan** auf. Das ist die ABSCHLIESSENDE Aktion. KEINE Antwort als freier Text — IMMER build_final_plan.

KRITISCH (Korrektheit):
- location_id in build_final_plan MUSS exakt einer "id" aus den vorherigen Tool-Returns entsprechen — diese sind UUIDs im Format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
- NIE den Namen einer Location als location_id einsetzen. NIE eine ID einer anderen Location verwenden.
- Wenn du keine passende Location findest, lass sie weg statt eine falsche ID zu schreiben.

Sonstiges:
- Zeitfenster realistisch: Wege ~15 Min zwischen Stops, Essen 60-90 Min, Kultur 90-120 Min, Event laut Event-Zeit.
- Stops in chronologischer Reihenfolge.

Uhrzeiten (KRITISCH):
- Alle Uhrzeiten sind Berliner Ortszeit. scheduled_start_at IMMER als Ortszeit im Format YYYY-MM-DDTHH:MM, ohne "Z" und ohne Zeitzone.
- Bei Events scheduled_start_at = event_start_local aus dem find_event-Ergebnis.
- Das "Tagesfenster" aus den Constraints ist der Rahmen des Plans, außer der Wunsch nennt ausdrücklich andere Uhrzeiten.

Familie (KRITISCH, gilt immer):
- Wenn eine "Familien-Zeitregel" angegeben ist, ist sie eine harte Grenze: Kein Stop endet danach, kein Event beginnt danach. Lieber weniger Stops als zu späte.
- Keine Abendprogramme für Erwachsene (Comedy, Clubs, Bars, Partys, Spätkonzerte). find_nightlife bei Familie nicht verwenden.

Öffnungszeiten (KRITISCH):
- Tool-Returns enthalten "opening_hours" pro Kandidat (Format: OSM z.B. "Mo-Fr 11:00-15:00,17:00-23:00" oder "24/7").
- Vor jedem Stop pruefe die opening_hours gegen die geplante scheduled_start_at.
- Beispiele:
  * "Mo-Fr 11:00-15:00,17:00-23:00" ist Fr um 16:00 GESCHLOSSEN → nicht einplanen.
  * "Mo-Su 18:00-02:00" ist Sa 22:00 offen, Sa 15:00 zu.
  * "24/7" ist immer offen.
- Wenn eine Location zur geplanten Zeit zu waere, waehle eine passende offene Alternative aus den bereits gepullten Kandidaten. Wenn keine da ist, ruf den Discovery-Tool nochmal auf.

Anlass-Voice + Vibe-Tag-Mapping (für requireTags im Tool-Call):
- Date: romantisch, intim → requireTags: ["romantic","date-friendly","intimate","refined"]
- Familie: kinderfreundlich, kürzere Wege, früher Tagesabschluss → requireTags: ["family-friendly","kid-friendly","outdoor"]
- Freunde: gesellig, mix → requireTags: ["lively","group-friendly","casual"]
- Tourismus: Highlights, must-see → requireTags: ["tourist-classic","iconic","view"]
- Party: spätstart, eskalierend → requireTags: ["late-night","lively","iconic"]
- Solo: ruhig, kontemplativ → requireTags: ["cozy","refined","hidden-gem"]

Wichtig: requireTags ist OPTIONAL. Wenn du sie verwendest und 0 Kandidaten zurückkommen, ruf das gleiche Tool nochmal OHNE requireTags auf — sonst fehlen Stops.

Startpunkt-Regel:
- Wenn der User im Wunsch-Text einen Startpunkt nennt → der gewinnt.
- Sonst bevorzuge Stops, die nah am angegebenen Startpunkt liegen (idealerweise <5 km Luftlinie).
- Erster Stop sollte zeitlich/räumlich gut von dort erreichbar sein.`;

const VALID_PLAN_MODES: readonly PlanMode[] = ["morning", "midday", "evening", "fullday"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function ymdKey(ymd: BerlinYmd) {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

/**
 * Uhrzeit des Modells → echter Instant. Das Modell soll Berliner Ortszeit ohne
 * Zone liefern („2026-10-17T15:00"). Ein angehängtes „Z" oder Offset wird
 * bewusst ignoriert: Die Ziffern meinen in der Praxis immer die Wanduhr am
 * Ort. Vorher wurde der rohe String durchgereicht — der Browser las ihn als
 * Ortszeit, der Server (Vercel = UTC) rechnete das Ende aber in UTC. Ein
 * 22-Uhr-Stop endete so in der Anzeige um 01:30.
 */
function berlinInstantFromModelTime(raw: string | null | undefined, planYmd: BerlinYmd): Date | null {
  if (typeof raw !== "string") return null;
  const match = /(?:(\d{4})-(\d{2})-(\d{2})[T ])?(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const ymd: BerlinYmd = match[1]
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : planYmd;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) return null;
  return berlinInstant(ymd, hour * 60 + minute);
}

function planModeWindowText(planMode: PlanMode, family: FamilyTimeLimits | null): string {
  if (planMode === "morning") return "Vormittag (ca. 09:00–12:30)";
  if (planMode === "midday") return "Mittag (ca. 11:00–17:00)";
  if (planMode === "evening") {
    return family
      ? `später Nachmittag bis früher Abend (ca. ${formatClockMinutes(family.eveningStartMin)}–${formatClockMinutes(family.latestEndMin)})`
      : "Abend (ab ca. 18:00)";
  }
  return family
    ? `Ganzer Tag (ca. 10:00–${formatClockMinutes(family.latestEndMin)})`
    : "Ganzer Tag";
}

/**
 * Stops, die gegen die Familiengrenze verstoßen: Ende nach der Altersgrenze
 * (oder am Folgetag) bzw. Event-Beginn nach der Event-Grenze.
 */
function familyLateStops(stops: ResolvedStop[], limits: FamilyTimeLimits): ResolvedStop[] {
  return stops.filter((stop) => {
    const start = stop.scheduledStartAt ? new Date(stop.scheduledStartAt) : null;
    if (!start || !Number.isFinite(start.getTime())) return false;
    const startDay = berlinParts(start);
    const limitAt = berlinInstant(startDay, limits.latestEndMin).getTime();
    const end = stop.scheduledEndAt ? new Date(stop.scheduledEndAt) : null;
    if (end && Number.isFinite(end.getTime()) && end.getTime() > limitAt) return true;
    if (start.getTime() >= limitAt) return true;
    return stop.source === "event" && berlinMinutesOfDay(start) > limits.latestEventStartMin;
  });
}

function stopListText(stops: ResolvedStop[]) {
  return stops
    .map((stop) => {
      const start = stop.scheduledStartAt ? new Date(stop.scheduledStartAt) : null;
      const clock =
        start && Number.isFinite(start.getTime())
          ? formatClockMinutes(berlinMinutesOfDay(start))
          : "?";
      return `${stop.itemName} (${clock})`;
    })
    .join(", ");
}

async function resolveStopsFromDb(stops: AiStopPlan[], planYmd: BerlinYmd): Promise<ResolvedStop[]> {
  if (stops.length === 0) return [];
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const locationIds = stops.filter((s) => s.source !== "event").map((s) => s.location_id);
  const eventIds = stops.filter((s) => s.source === "event").map((s) => s.location_id);

  const [locRes, evRes] = await Promise.all([
    locationIds.length > 0
      ? sb
          .from("locations")
          .select("id,name,type,category,lat,lng,duration_min,reservation_url,opening_hours_raw")
          .in("id", locationIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    eventIds.length > 0
      ? sb
          .from("planner_events")
          // "name:title" ist eine PostgREST-Umbenennung: Die Tabelle hat title,
          // der Code unten liest row.name. Vorher stand hier schlicht "name",
          // dazu starts_at/ends_at - drei Spalten, die es nicht gibt. PostgREST
          // antwortete mit 42703, der Fehler wurde nicht geprueft, evMap blieb
          // leer und JEDER Event-Stop fiel unten aus dem Plan. starts_at/ends_at
          // werden hier ohnehin nicht gelesen und entfallen deshalb ganz.
          .select("id,name:title,category,lat,lng,start_at,end_at")
          .in("id", eventIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);

  // Ein Ladefehler darf nicht laenger als "keine Treffer" durchgehen - genau so
  // ist der Spaltenfehler oben monatelang unsichtbar geblieben.
  if (locRes.error) {
    console.error("[generate-plan-ai] Locations laden fehlgeschlagen:", locRes.error.message);
  }
  if (evRes.error) {
    console.error("[generate-plan-ai] Events laden fehlgeschlagen:", evRes.error.message);
  }

  const locMap = new Map<string, Record<string, unknown>>();
  for (const row of locRes.data ?? []) locMap.set(String(row.id), row);
  const evMap = new Map<string, Record<string, unknown>>();
  for (const row of evRes.data ?? []) evMap.set(String(row.id), row);

  const resolved: ResolvedStop[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const isEvent = s.source === "event";
    const row = isEvent ? evMap.get(s.location_id) : locMap.get(s.location_id);
    if (!row) continue;

    // Events beginnen, wann sie laut Datenbank beginnen — nicht, wann das
    // Modell sie hingeschrieben hat.
    const eventStart =
      isEvent && typeof row.start_at === "string" && Number.isFinite(new Date(row.start_at).getTime())
        ? new Date(row.start_at)
        : null;
    const startDate = eventStart ?? berlinInstantFromModelTime(s.scheduled_start_at, planYmd);
    const duration = s.duration_min ?? 60;
    const start = startDate ? startDate.toISOString() : null;
    const end = startDate ? new Date(startDate.getTime() + duration * 60_000).toISOString() : null;

    resolved.push({
      index: i + 1,
      label: s.label || (isEvent ? "Event" : "Stop"),
      hint: s.hint ?? "",
      itemId: String(row.id),
      // Quellen stellen dem Namen gelegentlich die Datumsspanne des
      // Gesamtfestivals voran - gleiche Bereinigung wie im klassischen Planner.
      itemName: isEvent
        ? normalizePlannerEventTitle(String(row.name ?? ""))
        : String(row.name ?? ""),
      itemType: String(row.type ?? "event"),
      itemCategory: (row.category as string | null) ?? null,
      lat: typeof row.lat === "number" ? (row.lat as number) : null,
      lng: typeof row.lng === "number" ? (row.lng as number) : null,
      scheduledStartAt: start,
      scheduledEndAt: end,
      durationMin: duration,
      source: isEvent ? "event" : "location",
      openingHoursRaw: (row.opening_hours_raw as string | null) ?? null,
    });
  }
  return resolved;
}

export async function POST(req: Request) {
  // Harte Obergrenze pro IP — greift auch für anonyme Aufrufe, die vom
  // Premium-Gate bewusst nicht erfasst werden (Marketing/Demo).
  const limited = enforceRateLimit(req, "ai:generate-plan", RATE_RULES.ai);
  if (limited) return limited;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const citySlug = typeof body?.citySlug === "string" ? body.citySlug.trim() : "";
    const planDate = typeof body?.planDate === "string" ? body.planDate.trim() : "";
    const budget = typeof body?.budget === "string" ? body.budget.trim() : "medium";
    const occasion = typeof body?.occasion === "string" ? body.occasion.trim() : "";
    const startPointLabel = typeof body?.startPointLabel === "string" ? body.startPointLabel.trim() : "";
    const startPointLat = typeof body?.startPointLat === "number" ? body.startPointLat : null;
    const startPointLng = typeof body?.startPointLng === "number" ? body.startPointLng : null;
    const interests = Array.isArray(body?.interests)
      ? body.interests.filter((x: unknown): x is string => typeof x === "string").slice(0, 12)
      : [];
    const stopsCount = typeof body?.stopsCount === "number" ? Math.max(2, Math.min(8, body.stopsCount)) : null;
    const familyAgeBand = typeof body?.familyAgeBand === "string" ? body.familyAgeBand.trim() : "";
    const planMode: PlanMode | null = VALID_PLAN_MODES.includes(body?.planMode)
      ? (body.planMode as PlanMode)
      : null;
    const groupEnabled = body?.groupEnabled === true;
    const groupSize = typeof body?.groupSize === "number" ? body.groupSize : null;

    if (!prompt || !citySlug) {
      return NextResponse.json({ error: "prompt + citySlug required" }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: "prompt too long" }, { status: 400 });
    }

    // Premium-Gate. Wichtig: Die Nutzer-ID wird nicht nur aus dem
    // Authorization-Header gelesen, sondern notfalls aus der Cookie-Session.
    // Vorher hieß "kein Header" = "kein Gate", wodurch sich das Free-Limit
    // durch schlichtes Weglassen des Tokens umgehen ließ.
    const userId = await getRequestUserId(req);

    if (userId) {
      const sbAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const status = await getUserPremiumStatus(sbAuth, userId);
      if (status.limitReached) {
        return NextResponse.json(
          {
            error: "free_limit_reached",
            limit: FREE_AI_PLANS_PER_MONTH,
            used: status.aiPlansUsedThisMonth,
            upgradeUrl: "/api/stripe/user-checkout",
          },
          { status: 402 }
        );
      }
    }

    // Familiengrenzen gelten auch ohne mitgeschicktes Altersband — dann mit
    // dem Standardband, wie im klassischen Planner.
    const familyBand: FamilyAgeBand | null =
      occasion === "family" ? resolveFamilyAgeBand(familyAgeBand) ?? DEFAULT_FAMILY_AGE_BAND : null;
    const familyLimits = familyBand ? familyTimeLimits(familyBand) : null;
    const planYmd = parseYmd(planDate) ?? berlinToday();
    const toolContext: AiToolContext = {
      family: familyLimits
        ? {
            limits: familyLimits,
            earliestEventStartMin: familyEarliestEventStartMin(familyLimits, planMode),
          }
        : null,
    };

    const userLines: string[] = [
      `Stadt: ${citySlug}`,
      `Datum: ${planDate || ymdKey(planYmd)}`,
      `Budget: ${budget}`,
    ];
    if (occasion) userLines.push(`Anlass: ${occasion}`);
    if (familyBand) {
      userLines.push(`Familien-Altersband: Kinder ${familyAgeBandShortLabel(familyBand)}`);
      userLines.push(`Familien-Zeitregel: ${familyTimeRuleText(familyBand)} (Berliner Ortszeit).`);
    }
    if (planMode) userLines.push(`Tagesfenster: ${planModeWindowText(planMode, familyLimits)}`);
    if (startPointLabel) {
      const coords =
        typeof startPointLat === "number" && typeof startPointLng === "number"
          ? ` (${startPointLat.toFixed(4)}, ${startPointLng.toFixed(4)})`
          : "";
      userLines.push(`Startpunkt: ${startPointLabel}${coords}`);
    }
    if (interests.length > 0) userLines.push(`Interessen: ${interests.join(", ")}`);
    if (typeof stopsCount === "number") userLines.push(`Gewünschte Stops: ${stopsCount}`);
    if (groupEnabled) {
      userLines.push(`Gruppe: ${groupSize ? `${groupSize} Personen` : "ja"}`);
    }
    userLines.push("", `Wunsch: ${prompt}`);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userLines.join("\n") },
    ];

    let toolCallCount = 0;
    let totalCandidates: AiCandidate[] = [];
    const validCandidateIds = new Set<string>();
    let retriedForValidation = false;
    // Eigene Korrekturrunde für die Familiengrenze, damit eine vorherige
    // ID- oder Öffnungszeiten-Korrektur sie nicht verbraucht.
    let retriedForFamilyTime = false;
    let familyLateStopsDropped = 0;
    const TARGET_STOPS = stopsCount ?? 4;

    /**
     * Harte Nachprüfung der Familiengrenze. Erst eine Korrekturrunde, danach
     * werden zu späte Stops serverseitig gestrichen — das Modell darf die
     * Grenze nie durchreichen.
     */
    const enforceFamilyTime = (
      resolved: ResolvedStop[]
    ): { kind: "ok"; stops: ResolvedStop[] } | { kind: "retry"; message: string } => {
      if (!familyLimits || !familyBand) return { kind: "ok", stops: resolved };
      const late = familyLateStops(resolved, familyLimits);
      if (late.length === 0) return { kind: "ok", stops: resolved };
      if (!retriedForFamilyTime) {
        retriedForFamilyTime = true;
        return {
          kind: "retry",
          message: `Familienplan zu spät für Kinder ${familyAgeBandShortLabel(familyBand)}: ${stopListText(late)}. Regel: ${familyTimeRuleText(familyBand)}. Ersetze diese Stops durch frühere, kinderfreundliche Alternativen aus den bisherigen Tool-Returns oder lass sie weg.`,
        };
      }
      const lateIds = new Set(late.map((stop) => stop.itemId));
      familyLateStopsDropped = late.length;
      return {
        kind: "ok",
        stops: resolved
          .filter((stop) => !lateIds.has(stop.itemId))
          .map((stop, index) => ({ ...stop, index: index + 1 })),
      };
    };
    const familyEmptyPlanResponse = () =>
      NextResponse.json(
        {
          error: "no family-compatible stops",
          detail: familyBand ? familyTimeRuleText(familyBand) : null,
        },
        { status: 422 }
      );

    const MAX_ITER = 10;
    const TOOL_BUDGET = 6; // ab dieser Iteration werden Tools gesperrt und JSON erzwungen

    // Tool-Calling-Loop. Cap damit das Modell nicht endlos lookt.
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const exhausted = iter >= TOOL_BUDGET;

      // Wenn Tool-Budget aufgebraucht: User-Nudge + zwinge build_final_plan-Aufruf.
      if (exhausted && messages[messages.length - 1]?.role !== "user") {
        messages.push({
          role: "user",
          content:
            "Genug Kandidaten gesammelt. Ruf JETZT build_final_plan auf — keine weiteren Discovery-Tools.",
        });
      }

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 800,
        tools: AI_PLANNER_TOOLS as unknown as OpenAI.Chat.ChatCompletionTool[],
        tool_choice: exhausted
          ? { type: "function", function: { name: "build_final_plan" } }
          : "auto",
        messages,
      });

      const msg = completion.choices[0]?.message;
      if (!msg) break;

      // Append assistant message (potentially with tool_calls)
      messages.push(msg as OpenAI.Chat.ChatCompletionMessageParam);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // Final answer
        const raw = msg.content ?? "";
        let plan: AiPlanResult | null = null;
        try {
          // LLM might wrap JSON in ```json
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) plan = JSON.parse(match[0]) as AiPlanResult;
        } catch {
          plan = null;
        }
        if (!plan || !Array.isArray(plan.stops)) {
          return NextResponse.json(
            { error: "LLM returned no valid plan", raw },
            { status: 500 }
          );
        }

        // Validation: alle location_ids müssen aus den Tool-Returns stammen,
        // und stops.length sollte TARGET_STOPS treffen. Ein Retry.
        const invalidIds = plan.stops
          .filter((s) => s.source !== "event")
          .map((s) => s.location_id)
          .filter((id) => !validCandidateIds.has(id));
        const countMismatch =
          Math.abs(plan.stops.length - TARGET_STOPS) > 1; // ±1 toleriert
        if ((invalidIds.length > 0 || countMismatch) && !retriedForValidation) {
          retriedForValidation = true;
          const issues: string[] = [];
          if (invalidIds.length > 0) {
            issues.push(
              `${invalidIds.length} location_id(s) sind keine echten UUIDs aus den Tool-Returns: ${invalidIds.slice(0, 3).join(", ")}. Bitte ERSETZEN mit gueltigen IDs aus den bisherigen Kandidaten.`
            );
          }
          if (countMismatch) {
            issues.push(
              `Du hast ${plan.stops.length} Stops geliefert, gewünscht waren ${TARGET_STOPS}. Bitte korrigieren auf genau ${TARGET_STOPS} Stops.`
            );
          }
          messages.push({
            role: "user",
            content: `Dein Plan hat Probleme:\n- ${issues.join("\n- ")}\n\nGib mir den korrigierten JSON-Plan.`,
          });
          continue; // Loop läuft weiter, nächste Iteration liefert hoffentlich besseren Plan
        }

        const resolvedRaw = await resolveStopsFromDb(plan.stops, planYmd);
        if (resolvedRaw.length === 0) {
          return NextResponse.json(
            { error: "no valid locations resolved", rawStops: plan.stops },
            { status: 500 }
          );
        }

        const familyCheck = enforceFamilyTime(resolvedRaw);
        if (familyCheck.kind === "retry") {
          messages.push({
            role: "user",
            content: `${familyCheck.message}\n\nGib mir den korrigierten Plan über build_final_plan.`,
          });
          continue;
        }
        const resolved = familyCheck.stops;
        if (resolved.length === 0) return familyEmptyPlanResponse();

        return NextResponse.json({
          summary: plan.summary ?? "",
          stops: resolved,
          meta: {
            model: "gpt-4o-mini",
            toolCalls: toolCallCount,
            candidatesPulled: totalCandidates.length,
            usage: completion.usage,
            retried: retriedForValidation,
            familyLateStopsDropped,
          },
        });
      }

      // Erst pruefen: hat das Modell build_final_plan aufgerufen? Wenn ja, fertig.
      const finalCall = msg.tool_calls.find(
        (tc) => tc.type === "function" && tc.function.name === "build_final_plan"
      );
      if (finalCall && finalCall.type === "function") {
        let finalArgs: AiPlanResult | null = null;
        try {
          finalArgs = JSON.parse(finalCall.function.arguments || "{}") as AiPlanResult;
        } catch {
          finalArgs = null;
        }
        if (!finalArgs || !Array.isArray(finalArgs.stops)) {
          // Modell hat das Tool kaputt aufgerufen → Korrektur-Loop
          messages.push({
            role: "tool",
            tool_call_id: finalCall.id,
            content: JSON.stringify({ error: "build_final_plan args invalid — please retry with correct schema" }),
          });
          continue;
        }

        const invalidIds = finalArgs.stops
          .filter((s) => s.source !== "event")
          .map((s) => s.location_id)
          .filter((id) => !validCandidateIds.has(id));
        const countMismatch = Math.abs(finalArgs.stops.length - TARGET_STOPS) > 1;
        if ((invalidIds.length > 0 || countMismatch) && !retriedForValidation) {
          retriedForValidation = true;
          const issues: string[] = [];
          if (invalidIds.length > 0) {
            issues.push(
              `${invalidIds.length} location_id(s) sind keine echten UUIDs aus den Tool-Returns: ${invalidIds.slice(0, 3).join(", ")}.`
            );
          }
          if (countMismatch) {
            issues.push(
              `Du hast ${finalArgs.stops.length} Stops geliefert, gewünscht waren ${TARGET_STOPS}.`
            );
          }
          messages.push({
            role: "tool",
            tool_call_id: finalCall.id,
            content: JSON.stringify({ error: issues.join(" ") + " Bitte build_final_plan nochmal korrigiert aufrufen." }),
          });
          continue;
        }

        const resolvedRaw = await resolveStopsFromDb(finalArgs.stops, planYmd);
        if (resolvedRaw.length === 0) {
          return NextResponse.json(
            { error: "no valid locations resolved", rawStops: finalArgs.stops },
            { status: 500 }
          );
        }

        // Post-Validation: Oeffnungszeiten. Modell weiss oft nicht ob
        // "Piccola Pizza" um 23:30 noch offen ist. Wir pruefen hier gegen
        // opening_hours_raw und schicken eine Correction-Round wenn zu.
        const closedStops = resolvedRaw.filter((r) => {
          if (r.source === "event") return false; // Events haben starts_at, kein opening_hours-Konzept
          if (!r.scheduledStartAt) return false;
          const at = new Date(r.scheduledStartAt);
          if (!Number.isFinite(at.getTime())) return false;
          const raw = (r as unknown as { openingHoursRaw?: string | null }).openingHoursRaw ?? null;
          return !isOpenAt(raw, at, { bufferMin: 30 });
        });
        if (closedStops.length > 0 && !retriedForValidation) {
          retriedForValidation = true;
          // Uhrzeit in Ortszeit — scheduledStartAt ist seit der Normalisierung UTC.
          const list = stopListText(closedStops);
          messages.push({
            role: "tool",
            tool_call_id: finalCall.id,
            content: JSON.stringify({
              error: `Diese Locations sind zur geplanten Zeit geschlossen: ${list}. Bitte ersetze sie durch geeignete Alternativen aus den vorherigen Tool-Returns die zur geplanten Uhrzeit geoeffnet haben. Ruf danach build_final_plan erneut auf.`,
            }),
          });
          continue;
        }

        const familyCheck = enforceFamilyTime(resolvedRaw);
        if (familyCheck.kind === "retry") {
          messages.push({
            role: "tool",
            tool_call_id: finalCall.id,
            content: JSON.stringify({
              error: `${familyCheck.message} Ruf danach build_final_plan erneut auf.`,
            }),
          });
          continue;
        }
        const resolved = familyCheck.stops;
        if (resolved.length === 0) return familyEmptyPlanResponse();

        return NextResponse.json({
          summary: finalArgs.summary ?? "",
          stops: resolved,
          meta: {
            model: "gpt-4o-mini",
            toolCalls: toolCallCount,
            candidatesPulled: totalCandidates.length,
            usage: completion.usage,
            retried: retriedForValidation,
            via: "build_final_plan",
            closedStopsDropped: 0,
            familyLateStopsDropped,
          },
        });
      }

      // Normale Discovery-Tools ausführen
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        toolCallCount += 1;
        const name = tc.function.name as ToolName;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        // Always inject citySlug to prevent LLM from forgetting
        if (!args.citySlug) args.citySlug = citySlug;
        if (name === "find_event" && !args.date) args.date = planDate;
        // Auto-inject Startpunkt-Geo wenn vorhanden — Modell vergisst es sonst
        if (typeof startPointLat === "number" && typeof startPointLng === "number") {
          if (typeof args.nearLat !== "number") args.nearLat = startPointLat;
          if (typeof args.nearLng !== "number") args.nearLng = startPointLng;
          if (typeof args.maxKm !== "number") args.maxKm = 5;
        }

        try {
          // Familien: Nachtleben ist nie ein passender Stop — leere Antwort
          // statt Bars, damit das Modell gar nicht erst darauf baut.
          const result =
            familyLimits && name === "find_nightlife"
              ? []
              : await callTool(name, args, toolContext);
          totalCandidates = totalCandidates.concat(result);
          for (const c of result) validCandidateIds.add(c.id);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result.slice(0, 12)),
          });
        } catch (toolErr) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: String(toolErr) }),
          });
        }
      }
    }

    console.error("[generate-plan-ai] max iterations reached", {
      toolCallCount,
      candidatesPulled: totalCandidates.length,
      lastMessages: messages.slice(-3).map((m) => ({ role: m.role, contentLength: typeof m.content === "string" ? m.content.length : -1 })),
    });
    return NextResponse.json({ error: "max iterations reached" }, { status: 500 });
  } catch (err) {
    console.error("[generate-plan-ai]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
