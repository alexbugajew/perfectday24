// AI-basierter Tagesplaner (Phase 1 MVP)
// =====================================
// Function-Calling-Loop mit gpt-4o-mini:
// 1. User-Prompt + Stadt + Datum kommen rein
// 2. LLM ruft Tools (find_food/culture/activity/nightlife/event) auf
// 3. LLM bekommt die DB-Kandidaten zurück, baut Stop-Plan mit echten IDs
// 4. Server resolvet IDs zu echten Locations, mapped auf PlannedStop[]
//
// Output kompatibel mit dem existing Stop-Card-Format aus PlannerStopListSection.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_PLANNER_TOOLS, callTool, type ToolName, type AiCandidate } from "@/lib/ai-planner/tools";
import { createClient } from "@supabase/supabase-js";
import { getUserPremiumStatus, FREE_AI_PLANS_PER_MONTH } from "@/lib/premium/limits";
import { isOpenAt } from "@/lib/planner/opening-hours";

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
- Familie: kinderfreundlich, kürzere Wege → requireTags: ["family-friendly","kid-friendly","outdoor"]
- Freunde: gesellig, mix → requireTags: ["lively","group-friendly","casual"]
- Tourismus: Highlights, must-see → requireTags: ["tourist-classic","iconic","view"]
- Party: spätstart, eskalierend → requireTags: ["late-night","lively","iconic"]
- Solo: ruhig, kontemplativ → requireTags: ["cozy","refined","hidden-gem"]

Wichtig: requireTags ist OPTIONAL. Wenn du sie verwendest und 0 Kandidaten zurückkommen, ruf das gleiche Tool nochmal OHNE requireTags auf — sonst fehlen Stops.

Startpunkt-Regel:
- Wenn der User im Wunsch-Text einen Startpunkt nennt → der gewinnt.
- Sonst bevorzuge Stops, die nah am angegebenen Startpunkt liegen (idealerweise <5 km Luftlinie).
- Erster Stop sollte zeitlich/räumlich gut von dort erreichbar sein.`;

async function resolveStopsFromDb(stops: AiStopPlan[]): Promise<ResolvedStop[]> {
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
          .select("id,name,category,starts_at,ends_at,lat,lng")
          .in("id", eventIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);

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

    const start = s.scheduled_start_at ?? null;
    const duration = s.duration_min ?? 60;
    const end =
      start && Number.isFinite(new Date(start).getTime())
        ? new Date(new Date(start).getTime() + duration * 60_000).toISOString()
        : null;

    resolved.push({
      index: i + 1,
      label: s.label || (isEvent ? "Event" : "Stop"),
      hint: s.hint ?? "",
      itemId: String(row.id),
      itemName: String(row.name ?? ""),
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
    const groupEnabled = body?.groupEnabled === true;
    const groupSize = typeof body?.groupSize === "number" ? body.groupSize : null;

    if (!prompt || !citySlug) {
      return NextResponse.json({ error: "prompt + citySlug required" }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: "prompt too long" }, { status: 400 });
    }

    // Premium-Gate: eingeloggte User gegen Free-Limit prüfen.
    // Ohne Auth kein Gate → Marketing/Demo funktioniert weiter.
    const authHeader = req.headers.get("authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (accessToken) {
      const sbAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: userRes } = await sbAuth.auth.getUser(accessToken);
      const userId = userRes?.user?.id ?? null;
      if (userId) {
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
    }

    const userLines: string[] = [
      `Stadt: ${citySlug}`,
      `Datum: ${planDate || "(heute)"}`,
      `Budget: ${budget}`,
    ];
    if (occasion) userLines.push(`Anlass: ${occasion}`);
    if (familyAgeBand && occasion === "family") userLines.push(`Familien-Altersband: ${familyAgeBand}`);
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
    const TARGET_STOPS = stopsCount ?? 4;

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

        const resolved = await resolveStopsFromDb(plan.stops);
        if (resolved.length === 0) {
          return NextResponse.json(
            { error: "no valid locations resolved", rawStops: plan.stops },
            { status: 500 }
          );
        }

        return NextResponse.json({
          summary: plan.summary ?? "",
          stops: resolved,
          meta: {
            model: "gpt-4o-mini",
            toolCalls: toolCallCount,
            candidatesPulled: totalCandidates.length,
            usage: completion.usage,
            retried: retriedForValidation,
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

        const resolved = await resolveStopsFromDb(finalArgs.stops);
        if (resolved.length === 0) {
          return NextResponse.json(
            { error: "no valid locations resolved", rawStops: finalArgs.stops },
            { status: 500 }
          );
        }

        // Post-Validation: Oeffnungszeiten. Modell weiss oft nicht ob
        // "Piccola Pizza" um 23:30 noch offen ist. Wir pruefen hier gegen
        // opening_hours_raw und schicken eine Correction-Round wenn zu.
        const closedStops = resolved.filter((r) => {
          if (r.source === "event") return false; // Events haben starts_at, kein opening_hours-Konzept
          if (!r.scheduledStartAt) return false;
          const at = new Date(r.scheduledStartAt);
          if (!Number.isFinite(at.getTime())) return false;
          const raw = (r as unknown as { openingHoursRaw?: string | null }).openingHoursRaw ?? null;
          return !isOpenAt(raw, at, { bufferMin: 30 });
        });
        if (closedStops.length > 0 && !retriedForValidation) {
          retriedForValidation = true;
          const list = closedStops.map((s) => `${s.itemName} (geplant ${s.scheduledStartAt?.slice(11, 16)})`).join(", ");
          messages.push({
            role: "tool",
            tool_call_id: finalCall.id,
            content: JSON.stringify({
              error: `Diese Locations sind zur geplanten Zeit geschlossen: ${list}. Bitte ersetze sie durch geeignete Alternativen aus den vorherigen Tool-Returns die zur geplanten Uhrzeit geoeffnet haben. Ruf danach build_final_plan erneut auf.`,
            }),
          });
          continue;
        }

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
          const result = await callTool(name, args);
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
