// Einladende Kurzbeschreibungen für Planner-Locations — on-demand mit DB-Cache.
// =============================================================================
// Der Planner fragt hier die Beschreibungen der gerade geplanten Stops ab.
// Bereits gepflegte Texte (Location-Besitzer oder früherer KI-Lauf) kommen
// direkt aus locations.description; fehlende werden in EINEM gpt-5.2-Call
// generiert und gecacht, damit jede Location nur einmal Kosten verursacht.
// Besitzer-Texte werden nie überschrieben (Update nur wenn description NULL).

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_IDS = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSTRUCTIONS = `Du bist Reiseredakteur für PerfectDay24 und beschreibst Locations für Tagespläne
in deutschen Städten. Du bekommst pro Location Name, Typ, Kategorie, Stadt und Tags.

Regeln:
- Je Location 1 bis 2 einladende deutsche Sätze (ca. 18–35 Wörter): welche Art Erlebnis dort wartet
  und für welchen Moment des Tages es passt.
- Fakten NUR aus Typ, Kategorie, Tags und Allgemeinwissen zu bekannten Sehenswürdigkeiten ableiten.
  NICHTS Spezifisches erfinden: keine Preise, Öffnungszeiten, Gerichte-Namen, Interieur-Details
  oder Superlative. Bei unbekannten Orten beim Erlebnis-Typ bleiben.
- Ton: warm, konkret, auf Augenhöhe. Keine Emojis, keine Anführungszeichen, keine Werbefloskeln.
- Antworte NUR mit einem JSON-Array: [{"id": "<uuid>", "text": "<Beschreibung>"}, ...] für ALLE Locations.`;

type LocationLite = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  city_slug: string | null;
  tags: unknown;
  description: string | null;
};

function parseDescriptions(text: string): Array<{ id: string; text: string }> {
  const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Antwort ist kein Array");
  return parsed
    .map((entry) => ({
      id: typeof entry?.id === "string" ? entry.id : "",
      text: typeof entry?.text === "string" ? entry.text.trim() : "",
    }))
    .filter((entry) => UUID_RE.test(entry.id) && entry.text.length >= 30 && entry.text.length <= 400);
}

function tagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string").slice(0, 6);
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "loc:describe", RATE_RULES.aiLight);
  if (limited) return limited;

  let body: { locationIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ids = Array.isArray(body.locationIds)
    ? Array.from(
        new Set(
          body.locationIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id))
        )
      ).slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ descriptions: {} });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: rows, error } = await sb
    .from("locations")
    .select("id,name,type,category,city_slug,tags,description")
    .in("id", ids)
    .eq("is_plannable", true);
  if (error) {
    console.error("[locations/describe] load error:", error.message);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  const locations = (rows ?? []) as LocationLite[];
  const descriptions: Record<string, string> = {};
  for (const location of locations) {
    if (location.description && location.description.trim().length > 0) {
      descriptions[location.id] = location.description.trim();
    }
  }

  const missing = locations.filter((location) => !descriptions[location.id]);
  if (missing.length === 0 || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ descriptions });
  }

  // Stadtnamen für den Prompt auflösen (Slug allein wäre für das Modell mehrdeutig).
  const citySlugs = Array.from(
    new Set(missing.map((location) => location.city_slug).filter((slug): slug is string => Boolean(slug)))
  );
  const cityNames = new Map<string, string>();
  if (citySlugs.length > 0) {
    const { data: cities } = await sb.from("cities").select("slug,name").in("slug", citySlugs);
    for (const city of cities ?? []) cityNames.set(city.slug, city.name);
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.responses.create({
      model: "gpt-5.2",
      instructions: INSTRUCTIONS,
      input: JSON.stringify(
        missing.map((location) => ({
          id: location.id,
          name: location.name,
          typ: location.type,
          kategorie: location.category,
          stadt: cityNames.get(location.city_slug ?? "") ?? location.city_slug,
          tags: tagList(location.tags),
        }))
      ),
    });

    const generated = parseDescriptions(resp.output_text ?? "");
    const allowedIds = new Set(missing.map((location) => location.id));
    for (const entry of generated) {
      if (!allowedIds.has(entry.id)) continue;
      descriptions[entry.id] = entry.text;
      // Cache: nur füllen, nie einen (z. B. parallel gepflegten) Besitzer-Text überschreiben.
      const { error: updateError } = await sb
        .from("locations")
        .update({ description: entry.text })
        .eq("id", entry.id)
        .is("description", null);
      if (updateError) {
        console.error("[locations/describe] cache error:", entry.id, updateError.message);
      }
    }
  } catch (err) {
    // Generierung fehlgeschlagen → gecachte Texte trotzdem liefern.
    console.error("[locations/describe]", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ descriptions });
}
