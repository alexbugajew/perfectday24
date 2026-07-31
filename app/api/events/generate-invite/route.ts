// app/api/events/generate-invite/route.ts
//
// KI-Generierung für die Gast-Einladung: persönlicher Einladungstext
// (mode: "text") oder Titelbild (mode: "image", landet in Supabase-Storage).
// Auth: nur der Besitzer des Event-Plans darf generieren (Kostenkontrolle).

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";
import { getRequestUserId } from "@/lib/security/session";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 120;
const STORAGE_BUCKET = "partner-media";

type RequestBody = {
  mode: "text" | "image";
  planId: string;
  occasion: string;   // Label, z. B. "Geburtstag"
  city: string;       // Label, z. B. "Leipzig"
  eventDate?: string | null;
  hostName?: string | null;
  title?: string | null;
  guests?: number | null;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY fehlt");
  return new OpenAI({ apiKey });
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase-Service-Credentials fehlen");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function validateBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    (b.mode === "text" || b.mode === "image") &&
    typeof b.planId === "string" && b.planId.length > 0 && b.planId.length <= 64 &&
    typeof b.occasion === "string" && b.occasion.length > 0 && b.occasion.length <= MAX_TEXT_LENGTH &&
    typeof b.city === "string" && b.city.length <= MAX_TEXT_LENGTH &&
    (b.eventDate == null || typeof b.eventDate === "string") &&
    (b.hostName == null || (typeof b.hostName === "string" && b.hostName.length <= MAX_TEXT_LENGTH)) &&
    (b.title == null || (typeof b.title === "string" && b.title.length <= 200)) &&
    (b.guests == null || (typeof b.guests === "number" && Number.isFinite(b.guests)))
  );
}

const INVITE_TEXT_INSTRUCTIONS = `Du schreibst herzliche, stilvolle Einladungstexte auf Deutsch für private und
berufliche Anlässe. Regeln:
- 50 bis 90 Wörter, ein Absatz, keine Überschrift, keine Anrede-Platzhalter.
- Ton passend zum Anlass: privat = warm und persönlich (du/ihr), Konferenz/Firmenanlass = herzlich-professionell (Sie).
- Nenne Datum und Stadt, wenn vorhanden. Erfinde keine Uhrzeiten, Adressen oder Programmpunkte.
- Keine Emojis, keine Anführungszeichen um den gesamten Text, kein "Liebe Gäste"-Beginn.
- Antworte NUR mit dem Einladungstext.`;

function buildTextPrompt(b: RequestBody): string {
  const lines = [
    `Anlass: ${b.occasion}`,
    b.title ? `Titel des Events: ${b.title}` : null,
    b.city ? `Stadt: ${b.city}` : null,
    b.eventDate ? `Datum: ${b.eventDate}` : null,
    b.hostName ? `Gastgeber: ${b.hostName}` : null,
    b.guests ? `Erwartete Gäste: ${b.guests}` : null,
  ].filter(Boolean);
  return `Schreibe den Einladungstext für dieses Event:\n${lines.join("\n")}`;
}

// Bildmotive je Anlass — bewusst ohne Text im Bild (Typo aus Bildmodellen ist
// unzuverlässig); die Karte setzt Titel/Datum selbst in HTML.
const IMAGE_MOTIF: Record<string, string> = {
  Geburtstag:       "festliche Geburtstagstafel mit Kerzenschein, Konfetti und warmem Abendlicht",
  Hochzeit:         "elegante Hochzeitsszene mit zarten Blumenarrangements in Rosé und Champagner, weiches Licht",
  Teambuilding:     "freundliche Outdoor-Teamszene im Grünen, frische Salbeitöne, viel Tageslicht",
  Firmenfeier:      "stilvolle Abendveranstaltung mit Lichterketten und Sektgläsern, tiefblaue Abendstimmung",
  Kindergeburtstag: "fröhliche Kindergeburtstagsszene mit Luftballons und Wimpelketten in warmen Apricot-Tönen",
  Konferenz:        "modernes, helles Konferenz-Ambiente mit klaren Linien, dezente Slate-Töne",
  "Jubiläum":       "festliche Jubiläumsdekoration mit goldenen Akzenten und warmem Glanz",
  "Städtereise":    "stimmungsvolle europäische Altstadtgasse im Abendlicht, Teal- und Cremetöne",
};

function buildImagePrompt(b: RequestBody): string {
  const motif = IMAGE_MOTIF[b.occasion] ?? `stimmungsvolle, festliche Szene passend zu: ${b.occasion}`;
  const city = b.city ? ` Die Szene darf dezent an ${b.city} erinnern.` : "";
  return (
    `Elegantes Titelbild für eine Einladungskarte: ${motif}.${city} ` +
    `Hochwertiger editorialer Stil, weiche natürliche Farben, ruhige Komposition mit Tiefe. ` +
    `WICHTIG: kein Text, keine Buchstaben, keine Zahlen, keine Logos, keine Wasserzeichen im Bild.`
  );
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "ai:generate-invite", RATE_RULES.ai);
  if (limited) return limited;

  try {
    const body = await req.json() as unknown;
    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "Pflichtfelder fehlen: mode ('text'|'image'), planId, occasion" },
        { status: 400 }
      );
    }

    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
    }

    // Ownership-Check: nur der Plan-Besitzer darf generieren.
    const admin = getServiceClient();
    const { data: planRow, error: planError } = await admin
      .from("event_plans")
      .select("id, user_id")
      .eq("id", body.planId)
      .maybeSingle();
    if (planError || !planRow || planRow.user_id !== userId) {
      return NextResponse.json({ error: "Event-Plan nicht gefunden." }, { status: 404 });
    }

    const client = getOpenAIClient();

    if (body.mode === "text") {
      const resp = await client.responses.create({
        model: "gpt-5.2",
        instructions: INVITE_TEXT_INSTRUCTIONS,
        input: buildTextPrompt(body),
      });
      const text = (resp.output_text ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "KI hat keinen Text zurückgegeben." }, { status: 502 });
      }
      return NextResponse.json({ text });
    }

    // mode === "image"
    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt: buildImagePrompt(body),
      size: "1536x1024", // 3:2 — passt zum aspect-[3/2] der Einladungskarte
      quality: "medium",
    });
    const b64 = image.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "KI hat kein Bild zurückgegeben." }, { status: 502 });
    }

    const buffer = Buffer.from(b64, "base64");
    const path = `event-covers/${body.planId}/ai-${Date.now()}.png`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: "image/png", upsert: false });
    if (uploadError) {
      console.error("generate-invite: upload failed", uploadError);
      return NextResponse.json({ error: "Bild konnte nicht gespeichert werden." }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return NextResponse.json({ imageUrl: urlData.publicUrl });
  } catch (err) {
    console.error("generate-invite error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
