// app/api/generate-plan-text/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SlotPayload = {
  index: number;
  label: string;
  hint: string;
  durationMin: number | null;
  travelMinFromPrev: number | null;
  location: null | {
    id: string;
    name: string;
    type: string;
    reservation_url?: string | null;
    distanceKm?: number | null;
  };
};

export async function POST(req: Request) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const body = await req.json();

    const filters = body?.filters ?? {};
    const planMode = String(filters?.planMode ?? "fullday");
    const stops: SlotPayload[] = Array.isArray(body?.slots) ? body.slots : [];

    // Safety: sort by index
    stops.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const lines = stops.map((s) => {
      const loc = s.location
        ? `${s.location.name} (${s.location.type})`
        : "— (kein Treffer)";

      const dist = typeof s.location?.distanceKm === "number" ? ` • ${s.location!.distanceKm.toFixed(1)} km` : "";
      const dur = typeof s.durationMin === "number" ? ` • Dauer ~${s.durationMin} Min` : "";
      const travel = typeof s.travelMinFromPrev === "number" ? ` • Weg ~${s.travelMinFromPrev} Min` : "";
      return `${s.index}. ${s.label} – ${s.hint}\n   Vorschlag: ${loc}${dist}${dur}${travel}`;
    });

    const systemStyle = `
Du bist ein lokaler Tagesplaner. Schreibe auf Deutsch, klar, freundlich, strukturiert.
Wichtig:
- Frühstück = Café/Breakfast (morgens)
- Mittagessen = Restaurant (mittags)
- Abendessen = Restaurant (abends)
- Aktivitäten dazwischen kurz begründen (warum passt das zu Vorlieben/Budget/Anlass)
- Wenn ein Slot kein Treffer hat, gib eine Alternative ("Alternative: ...") und erkläre kurz, wie der Nutzer die Auswahl tauschen kann ("Tauschen"-Button).
- Gib am Ende eine kurze Zusammenfassung (Gesamtgefühl, Tipps).
    `.trim();

    const userPrompt = `
Plan-Modus: ${planMode}
Budget: ${String(filters?.budget ?? "—")}
Anlass: ${String(filters?.occasion ?? "—")}
Vorlieben: ${Array.isArray(body?.interests) ? body.interests.join(", ") : "—"}
Gruppe: ${filters?.groupEnabled ? "ja" : "nein"}

Slots:
${lines.join("\n\n")}
    `.trim();

    const resp = await client.responses.create({
      model: "gpt-5.2",
      instructions: systemStyle,
      input: userPrompt,
    });

    return NextResponse.json({ text: resp.output_text ?? "" });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ text: "Fehler beim Generieren." }, { status: 500 });
  }
}