import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  filters?: any;
  radiusKm?: number;
  sortMode?: string;
  activeLevel?: string;
  effectiveRadiusKm?: number | null;
  interests?: string[]; // <- NEU
  slots?: any[];        // <- sollte duration_min enthalten (falls vorhanden)
};

function safeJson(x: any) {
  try {
    return JSON.stringify(x ?? null);
  } catch {
    return "null";
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new NextResponse("OPENAI_API_KEY missing", { status: 500 });
    }

    const body = (await req.json()) as Body;

    const interests = Array.isArray(body.interests) ? body.interests : [];
    const slots = Array.isArray(body.slots) ? body.slots : [];

    // Prompt: kurz, stark an Interessen orientiert, inkl. Dauer-Hinweis
    const prompt = `
Du bist ein smarter City-Guide und Planungs-Assistent.
Schreibe eine kurze, schöne Beschreibung (6–10 Sätze) für den Tagesplan auf Deutsch.
Keine Aufzählungszeichen, keine Emojis, keine Überschriften.

WICHTIG: Die Nutzer-Interessen sollen deutlich erkennbar sein:
- Wenn es ein Restaurant gibt, priorisiere die passenden Küchen/Essensvorlieben.
- Bei Aktivitäten priorisiere passende Interessen (Kultur, Natur, Sport, Musik etc.).
- Berücksichtige duration_min (in Minuten), wenn vorhanden: erwähne "kurz/entspannt" oder "ausgedehnt" passend.

FILTER:
${safeJson(body.filters)}

INTERESSEN:
${safeJson(interests)}

PARAMETER:
radiusKm=${body.radiusKm}, sortMode=${body.sortMode}, activeLevel=${body.activeLevel}, effectiveRadiusKm=${body.effectiveRadiusKm}

SLOTS (JSON, ggf. mit duration_min):
${safeJson(slots)}
`.trim();

    const client = new OpenAI({ apiKey });

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du schreibst kurz, freundlich, konkret und umsetzungsorientiert." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const text = resp.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (e: any) {
    // OpenAI-Fehler sauber mappen (Quota/RateLimit etc.)
    const status = typeof e?.status === "number" ? e.status : 500;
    const msg =
      e?.code === "insufficient_quota"
        ? "OpenAI quota/billing fehlt (insufficient_quota)."
        : e?.message || "Server error";

    console.error("generate-plan-text error:", e);
    return new NextResponse(msg, { status });
  }
}