// app/api/roadtrip/suggest-stops/route.ts
// KI-gestützte Zwischenstopp-Vorschläge für eine Roadtrip-Route.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SuggestedStop, RoutePreference } from "@/lib/roadtrip/suggest-types";

export const runtime = "nodejs";
export const maxDuration = 30;

type RequestBody = {
  from: string;
  to: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  preferences: RoutePreference[];
  count?: number;
};

const PREFERENCE_DESCRIPTIONS: Record<RoutePreference, string> = {
  nature:    "Naturlandschaften, Wälder, Parks, Nationalparks",
  lake:      "Seen, Flüsse, Wasserfälle, Teiche",
  viewpoint: "Aussichtspunkte, Panoramen, Bergkuppen, Türme",
  culture:   "Museen, Galerien, historische Stätten, Kirchen, Klöster",
  castle:    "Burgen, Schlösser, Ruinen, Festungsanlagen",
  food:      "Lokale Restaurants, Brauerereien, Weingüter, Märkte mit regionalen Spezialitäten",
  town:      "Malerische Altstädte, Fachwerkhäuser, charmante Kleinstädte",
  adventure: "Klettern, Wandern, Rafting, Kanufahren, Hochseilgärten",
  beach:     "Strände, Küstenabschnitte, Badeorte",
  market:    "Wochenmärkte, Kunsthandwerkermärkte, lokale Spezialitätenmärkte",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("suggest-stops: OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "KI-Anfrage fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });
  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { from, to, fromLat, fromLng, toLat, toLng, preferences, count = 6 } = body;

  if (!from || !to) {
    return NextResponse.json({ error: "Start und Ziel sind erforderlich" }, { status: 400 });
  }

  const clampedCount = Math.min(Math.max(count, 3), 10);

  const prefText =
    preferences.length > 0
      ? preferences.map((p) => `- ${PREFERENCE_DESCRIPTIONS[p]}`).join("\n")
      : "- Abwechslungsreiche Mischung aus Natur, Kultur und interessanten Orten";

  const systemPrompt = `Du bist ein erfahrener deutscher Reiseplaner mit tiefer Kenntnis der Geographie,
Sehenswürdigkeiten und Geheimtipps in Deutschland und den umliegenden Ländern.

Deine Aufgabe: Für eine Autofahrt von ${from} nach ${to} schlage ich genau ${clampedCount} lohnenswerte
Zwischenstopps vor. Die Stopps sollen eine echte Bereicherung der Reise sein.

Präferenzen des Nutzers:
${prefText}

Wichtige Regeln:
1. Alle Stopps MÜSSEN geographisch zwischen ${from} (${fromLat.toFixed(4)}, ${fromLng.toFixed(4)})
   und ${to} (${toLat.toFixed(4)}, ${toLng.toFixed(4)}) liegen
2. Bevorzuge Stopps die direkt am Weg oder nur leicht davon abweichen
3. Koordinaten müssen EXAKT korrekt sein (basierend auf echten Geodaten)
4. Alle Texte auf Deutsch
5. Keine Wiederholungen, keine generischen Beschreibungen
6. Antworte NUR mit einem validen JSON-Array, kein weiterer Text

JSON-Format (exakt):
[
  {
    "name": "Rheinfall Schaffhausen",
    "category": "nature",
    "emoji": "💦",
    "description": "Der größte Wasserfall Europas...",
    "why_visit": "Ein einzigartiges Naturspektakel...",
    "detour": "slight",
    "lat": 47.6779,
    "lng": 8.6144,
    "duration_min": 90
  }
]

detour-Werte: "none" (direkt am Weg), "slight" (< 15 min Umweg), "moderate" (15-45 min), "significant" (> 45 min)`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Schlage ${clampedCount} Zwischenstopps für die Fahrt von ${from} nach ${to} vor. Antworte mit: {"stops": [...]}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { stops?: unknown[] };

    try {
      parsed = JSON.parse(rawContent) as { stops?: unknown[] };
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht verarbeitet werden" }, { status: 500 });
    }

    const rawStops = Array.isArray(parsed.stops) ? parsed.stops : [];

    // Validierung & Normalisierung
    const stops: SuggestedStop[] = rawStops
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .filter((s) => {
        const lat = typeof s.lat === "number" ? s.lat : parseFloat(String(s.lat));
        const lng = typeof s.lng === "number" ? s.lng : parseFloat(String(s.lng));
        return (
          typeof s.name === "string" &&
          s.name.length > 0 &&
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Math.abs(lat) <= 90 &&
          Math.abs(lng) <= 180
        );
      })
      .map((s, idx) => ({
        id: `stop-${idx}-${Date.now()}`,
        name: String(s.name),
        category: typeof s.category === "string" ? s.category : "nature",
        emoji: typeof s.emoji === "string" ? s.emoji : "📍",
        description: typeof s.description === "string" ? s.description : "",
        why_visit: typeof s.why_visit === "string" ? s.why_visit : "",
        detour: (["none", "slight", "moderate", "significant"].includes(String(s.detour))
          ? s.detour
          : "slight") as SuggestedStop["detour"],
        lat: typeof s.lat === "number" ? s.lat : parseFloat(String(s.lat)),
        lng: typeof s.lng === "number" ? s.lng : parseFloat(String(s.lng)),
        duration_min:
          typeof s.duration_min === "number" && s.duration_min > 0
            ? Math.round(s.duration_min)
            : 60,
      }));

    return NextResponse.json({ stops }, { status: 200 });
  } catch (err) {
    const e = err as { message?: string; status?: number; code?: string; error?: { code?: string; message?: string } };
    const httpStatus = e.status ?? "?";
    const errCode = e.code ?? e.error?.code ?? "?";
    const msg = (e.message ?? String(err)).slice(0, 200);
    console.error(`suggest-stops[${httpStatus}/${errCode}]: ${msg}`);
    return NextResponse.json(
      { error: "KI-Anfrage fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
