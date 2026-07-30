// app/api/generate-plan-text/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type StopExplain = {
  travelPenalty?: number;
  diversityPenalty?: number;
  slotBoost?: number;
  routingBonus?: number;
  finalScore?: number;
};

type SlotPayload = {
  index: number;
  label: string;
  hint: string;
  durationMin: number | null;
  travelMinFromPrev: number | null;
  explain?: StopExplain | null; // ✅ neu
  location: null | {
    id: string;
    name: string;
    type: string;
    reservation_url?: string | null;
    distanceKm?: number | null;

    // optional debug / scoring (kommt aus Page.tsx Payload)
    baseScore?: number;
    prefBoost?: number;
    totalScore?: number;
    matchLevel?: string | null;
  };
};

function safeStr(v: unknown, fallback = "—") {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  const t = s.trim();
  return t.length ? t : fallback;
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "ai:plan-text", RATE_RULES.aiLight);
  if (limited) return limited;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const body = await req.json();

    const filters = body?.filters ?? {};
    const planMode = safeStr(filters?.planMode, "fullday");
    const budget = safeStr(filters?.budget, "—");
    const occasion = safeStr(filters?.occasion, "—");

    const interests = Array.isArray(body?.interests) ? body.interests.map((x: unknown) => safeStr(x, "")).filter(Boolean) : [];
    const groupEnabled = Boolean(filters?.groupEnabled);
    const isRouteDescription = body?.purpose === "route_description";

    const stops: SlotPayload[] = Array.isArray(body?.slots) ? body.slots : [];

    // Safety: sort by index
    stops.sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));

    const lines = stops.map((s) => {
      const loc = s.location ? `${safeStr(s.location.name)} (${safeStr(s.location.type)})` : "— (kein Treffer)";

      const dist = typeof s.location?.distanceKm === "number" ? ` • ${s.location!.distanceKm.toFixed(1)} km` : "";
      const dur = typeof s.durationMin === "number" ? ` • Dauer ~${s.durationMin} Min` : "";
      const travel = typeof s.travelMinFromPrev === "number" ? ` • Weg ~${s.travelMinFromPrev} Min` : "";

      // ✅ Explainability (nur wenn vorhanden)
      const ex = s.explain
        ? `\n   Explain: final=${s.explain.finalScore ?? "—"} • travelPenalty=${s.explain.travelPenalty ?? "—"} • diversityPenalty=${
            s.explain.diversityPenalty ?? "—"
          } • slotBoost=${s.explain.slotBoost ?? "—"} • routingBonus=${s.explain.routingBonus ?? "—"}`
        : "";

      // optional score debug
      const scoreDbg =
        s.location && (typeof s.location.baseScore === "number" || typeof s.location.prefBoost === "number" || typeof s.location.totalScore === "number")
          ? `\n   Score: base=${s.location.baseScore ?? "—"} • pref=${s.location.prefBoost ?? "—"} • total=${s.location.totalScore ?? "—"} • level=${
              s.location.matchLevel ?? "—"
            }`
          : "";

      return `${s.index}. ${safeStr(s.label)} – ${safeStr(s.hint)}\n   Vorschlag: ${loc}${dist}${dur}${travel}${scoreDbg}${ex}`;
    });

    const routeDescriptionStyle = `
Du schreibst kurze Creator-Routenbeschreibungen auf Deutsch.

Ziel:
- Eine hochwertige Beschreibung fuer ein Route-Builder-Feld.
- 4-6 Saetze, fluessig, konkret, einladend.
- Keine Ueberschriften, keine Bulletpoints, keine Markdown-Listen.
- Nenne die Route nicht technisch als "Plan" oder "Slot-Liste".
- Beschreibe Stimmung, Anlass, Ablauf und warum die Stops zusammenpassen.
- Wenn Stops fehlen, bleibe allgemein und schreibe trotzdem veroeffentlichungsnah.
    `.trim();

    const plannerTextStyle = `
Du bist ein lokaler Tagesplaner. Schreibe auf Deutsch, klar, freundlich, strukturiert.

Harte Regeln:
- Frühstück = Café/Breakfast (morgens). Wenn kein Frühstück-Treffer existiert: schlage ein Café als Alternative vor.
- Mittagessen = Restaurant (mittags). Wenn kein Treffer: Alternative Restaurant vorschlagen.
- Abendessen = Restaurant (abends). Wenn kein Treffer: Alternative Restaurant vorschlagen.
- Aktivitäten dazwischen kurz begründen (warum passt das zu Vorlieben/Budget/Anlass).

Explainability:
- Nutze "Explain" (falls vorhanden) um kurz zu begründen: kurze Wege gut, Diversität gut (nicht 2x gleiche Kategorie), Slot-Passung wichtig.
- Erkläre es menschlich, nicht technisch.

Fehlende Slots:
- Wenn ein Slot "kein Treffer" hat, gib eine Alternative ("Alternative: ...") und erkläre kurz, wie der Nutzer die Auswahl tauschen kann ("Tauschen"-Button).

Output Format:
- Nutze Überschriften und Bulletpoints.
- Am Ende: kurze Zusammenfassung (Gesamtgefühl + 2–3 Tipps).
    `.trim();

    const systemStyle = isRouteDescription ? routeDescriptionStyle : plannerTextStyle;

    const routeDescriptionPrompt = `
Routentitel: ${safeStr(body?.routeTitle, "Neue Route")}
Stadt: ${safeStr(body?.cityLabel ?? filters?.citySlug, "â€”")}
Anlass: ${occasion}
Route-Profil: ${safeStr(filters?.routeProfile ?? filters?.planMode, "â€”")}
Thema: ${safeStr(filters?.theme, "â€”")}
Vorlieben/Tags: ${interests.length ? interests.join(", ") : "â€”"}
Gruppe: ${groupEnabled ? "ja" : "nein"}

Stops:
${lines.join("\n\n") || "Noch keine Stops hinterlegt."}
    `.trim();

    const plannerTextPrompt = `
Plan-Modus: ${planMode}
Budget: ${budget}
Anlass: ${occasion}
Vorlieben: ${interests.length ? interests.join(", ") : "—"}
Gruppe: ${groupEnabled ? "ja" : "nein"}

Slots:
${lines.join("\n\n")}
    `.trim();

    const userPrompt = isRouteDescription ? routeDescriptionPrompt : plannerTextPrompt;

    const resp = await client.responses.create({
      model: "gpt-5.2",
      instructions: systemStyle,
      input: userPrompt,
    });

    return NextResponse.json({ text: resp.output_text ?? "" });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ text: "Fehler beim Generieren." }, { status: 500 });
  }
}
