// app/api/parse-intent/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// City name → canonical slug lookup  (German, English, umlaut variants)
// ---------------------------------------------------------------------------
const CITY_NAME_TO_SLUG: Record<string, string> = {
  berlin: "berlin-berlin",
  hamburg: "hamburg-hamburg",
  muenchen: "muenchen",
  munich: "muenchen",
  frankfurt: "frankfurt-am-main",
  "frankfurt am main": "frankfurt-am-main",
  stuttgart: "stuttgart",
  duesseldorf: "duesseldorf",
  dusseldorf: "duesseldorf",
  koeln: "koeln",
  cologne: "koeln",
  leipzig: "leipzig",
  dresden: "dresden",
  hannover: "hannover",
  hanover: "hannover",
  nuernberg: "nuernberg",
  nuremberg: "nuernberg",
  bremen: "bremen",
  dortmund: "dortmund",
  essen: "essen",
  bonn: "bonn",
  muenster: "muenster",
  mannheim: "mannheim",
  wiesbaden: "wiesbaden",
  aachen: "aachen",
  karlsruhe: "karlsruhe",
  duisburg: "duisburg",
  bochum: "bochum",
  wuppertal: "wuppertal",
  bielefeld: "bielefeld",
  augsburg: "augsburg",
  braunschweig: "braunschweig",
  kiel: "kiel",
  gelsenkirchen: "gelsenkirchen",
  moenchengladbach: "moenchengladbach",
  magdeburg: "magdeburg",
  freiburg: "freiburg-im-breisgau",
  "freiburg im breisgau": "freiburg-im-breisgau",
  luebeck: "luebeck",
  lubeck: "luebeck",
  erfurt: "erfurt",
};

// German umlaut variants mapped separately (avoids encoding issues in regex)
const CITY_UMLAUT_MAP: Record<string, string> = {
  "münchen": "muenchen",   // münchen
  "köln": "koeln",                         // köln
  "düsseldorf": "duesseldorf", // düsseldorf
  "nürnberg": "nuernberg",  // nürnberg
  "münster": "muenster",   // münster
  "mönchengladbach": "moenchengladbach", // mönchengladbach
  "lübeck": "luebeck",           // lübeck
};

const CITY_SLUG_TO_LABEL: Record<string, string> = {
  "berlin-berlin": "Berlin",
  "hamburg-hamburg": "Hamburg",
  muenchen: "München",
  koeln: "Köln",
  "frankfurt-am-main": "Frankfurt",
  stuttgart: "Stuttgart",
  duesseldorf: "Düsseldorf",
  leipzig: "Leipzig",
  dresden: "Dresden",
  hannover: "Hannover",
  nuernberg: "Nürnberg",
  bremen: "Bremen",
  dortmund: "Dortmund",
  essen: "Essen",
  bonn: "Bonn",
  muenster: "Münster",
  mannheim: "Mannheim",
  wiesbaden: "Wiesbaden",
  aachen: "Aachen",
  karlsruhe: "Karlsruhe",
  duisburg: "Duisburg",
  bochum: "Bochum",
  wuppertal: "Wuppertal",
  bielefeld: "Bielefeld",
  augsburg: "Augsburg",
  braunschweig: "Braunschweig",
  kiel: "Kiel",
  gelsenkirchen: "Gelsenkirchen",
  moenchengladbach: "Mönchengladbach",
  magdeburg: "Magdeburg",
  "freiburg-im-breisgau": "Freiburg",
  luebeck: "Lübeck",
  erfurt: "Erfurt",
};

function resolveCity(rawCity: string | null | undefined): {
  citySlug: string | null;
  cityLabel: string | null;
} {
  if (!rawCity || rawCity.trim().length === 0) return { citySlug: null, cityLabel: null };
  const key = rawCity.toLowerCase().trim();

  // Check umlaut map first, then ASCII map
  const asciiSlug = CITY_UMLAUT_MAP[key] ?? null;
  const slug = asciiSlug
    ? (CITY_NAME_TO_SLUG[asciiSlug] ?? asciiSlug)
    : (CITY_NAME_TO_SLUG[key] ?? null);

  if (!slug) return { citySlug: null, cityLabel: null };
  return { citySlug: slug, cityLabel: CITY_SLUG_TO_LABEL[slug] ?? slug };
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Du bist ein Assistent fuer die App PerfectDay24, die Tagespläne für deutsche Städte erstellt.
Extrahiere aus der Nutzereingabe folgende Felder als JSON:

- city: Stadtname auf Deutsch (String oder null) — z.B. "München", "Berlin", "Köln"
- occasion: eines von "date" | "friends" | "family" | "tourism" | "party" oder null
  date = romantisch zu zweit, friends = mit Freunden/Kollegen, family = Familie mit Kindern,
  tourism = als Tourist/Städtereise, party = Feiern/Nachtleben
- experienceMode: eines von "classic" | "show" | "event_visit" | "market_festival" oder null
  classic = gemischter Tag, show = Konzert/Theater, event_visit = Event-Besuch, market_festival = Markt/Festival
- datePreference: eines von "today" | "tomorrow" | "this_weekend" | "flexible" oder null
- confidence: 0.0-1.0 (wie sicher du dir bei der Extraktion bist)

Antworte NUR mit validem JSON, kein Text davor oder danach.
Beispiel: {"city":"München","occasion":"date","experienceMode":null,"datePreference":"today","confidence":0.92}`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "ai:parse-intent", RATE_RULES.aiLight);
  if (limited) return limited;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const body = await req.json().catch(() => ({}));
    // Länge begrenzen, damit der Prompt nicht beliebig groß wird.
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";

    if (!text || text.length > 500) {
      return NextResponse.json(
        { error: "text fehlt oder zu lang" },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 120,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      city?: string | null;
      occasion?: string | null;
      experienceMode?: string | null;
      datePreference?: string | null;
      confidence?: number;
    } = {};

    try {
      parsed = JSON.parse(raw);
    } catch {
      // fall through with empty parsed
    }

    const VALID_OCCASIONS = new Set(["date", "friends", "family", "tourism", "party"]);
    const VALID_EXP_MODES = new Set(["classic", "show", "event_visit", "market_festival"]);
    const VALID_DATE_PREFS = new Set(["today", "tomorrow", "this_weekend", "flexible"]);

    const { citySlug, cityLabel } = resolveCity(parsed.city);

    return NextResponse.json({
      citySlug,
      cityLabel,
      occasion: VALID_OCCASIONS.has(parsed.occasion ?? "") ? parsed.occasion : null,
      experienceMode: VALID_EXP_MODES.has(parsed.experienceMode ?? "")
        ? parsed.experienceMode
        : null,
      datePreference: VALID_DATE_PREFS.has(parsed.datePreference ?? "")
        ? parsed.datePreference
        : null,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    });
  } catch (err) {
    console.error("[parse-intent]", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
