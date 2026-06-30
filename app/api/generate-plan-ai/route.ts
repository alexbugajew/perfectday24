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
};

const SYSTEM_PROMPT = `Du planst Tagesabläufe für PerfectDay24 in deutschen Städten.

Vorgehen:
1. Lies User-Wunsch + alle Constraints (Stadt, Datum, Anlass, Startpunkt, Interessen, gewünschte Stop-Anzahl, Budget).
2. Ruf die passenden Tools auf um Kandidaten zu bekommen (find_food, find_culture, find_activity, find_nightlife, find_event).
3. Wenn der User ein Event/Konzert/Show erwähnt ODER eine eindeutige Event-Affinität signalisiert, IMMER zuerst find_event aufrufen — Events sind feste Anker.
4. Wähle exakt so viele Stops wie unter "Gewünschte Stops" angegeben (Default: 4). Wenn nichts angegeben: 3–5.
5. Antworte am Ende mit EINEM JSON-Block:

{
  "summary": "Kurze Beschreibung was den Plan ausmacht (max 200 Zeichen).",
  "stops": [
    {
      "location_id": "<id aus den Tool-Results>",
      "label": "z.B. Aperitif | Lunch | Hauptmoment | Ausklang",
      "hint": "Was passiert hier konkret",
      "scheduled_start_at": "ISO timestamp im Datum",
      "duration_min": 60,
      "source": "location" oder "event"
    }
  ]
}

Wichtig:
- Nur location_id aus den Tool-Results verwenden (KEINE erfundenen IDs).
- Zeitfenster realistisch: Wege ~15 Min zwischen Stops, Essen 60-90 Min, Kultur 90-120 Min, Event laut Event-Zeit.
- Stops in chronologischer Reihenfolge ausgeben.
- KEIN Text außerhalb des JSON-Blocks.

Anlass-Voice:
- Date: romantisch, intim, kulinarisch, nicht überladen
- Familie: kinderfreundlich, kürzere Wege, mittlere Stop-Dauern, Park/Spielplatz wenn passend
- Freunde: gesellig, mix aus Action und Genuss, abends gerne Bar/Nightlife
- Tourismus: Highlights & "must-see", Kultur priorisiert, Wege auch länger ok
- Party: spätstart, eskalierende Energie, endet in Bar/Club
- Solo: ruhig, kontemplativ, weniger Stops, längere Verweildauer

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
          .select("id,name,type,category,lat,lng,duration_min,reservation_url")
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

    // Tool-Calling-Loop. Max 6 Iterationen damit das Modell nicht endlos läuft.
    for (let iter = 0; iter < 6; iter++) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 800,
        tools: AI_PLANNER_TOOLS as unknown as OpenAI.Chat.ChatCompletionTool[],
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
          },
        });
      }

      // Execute tool calls
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

        try {
          const result = await callTool(name, args);
          totalCandidates = totalCandidates.concat(result);
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

    return NextResponse.json({ error: "max iterations reached" }, { status: 500 });
  } catch (err) {
    console.error("[generate-plan-ai]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
