// app/api/events/generate-needs/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { EVENT_NEEDS_SYSTEM_PROMPT } from "@/lib/ai/event-system-prompt";
import { buildNeedsPrompt } from "@/lib/ai/event-prompts";
import type { NeedsPromptInput } from "@/lib/ai/event-prompts";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// Obergrenzen für Freitextfelder: begrenzen Token-Verbrauch pro Aufruf.
const MAX_TEXT_LENGTH = 120;
const MAX_INTERESTS = 12;

type RequestBody = {
  occasion: string;
  city: string;
  guests: number;
  budgetEur?: number | null;
  interests?: string[];
};

type NeedsResponse = {
  needs: string[];
  reasoning: string;
};

const VALID_NEED_SLUGS = new Set([
  "location", "catering", "musik", "deko", "florist",
  "fotografie", "video", "moderation", "animation",
  "torte", "technik", "transport",
]);

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY fehlt");
  return new OpenAI({ apiKey });
}

function validateBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.occasion === "string" && b.occasion.length > 0 && b.occasion.length <= MAX_TEXT_LENGTH &&
    typeof b.city === "string" && b.city.length > 0 && b.city.length <= MAX_TEXT_LENGTH &&
    typeof b.guests === "number" && Number.isFinite(b.guests) && b.guests > 0 && b.guests <= 100000 &&
    (b.interests === undefined ||
      b.interests === null ||
      (Array.isArray(b.interests) &&
        b.interests.length <= MAX_INTERESTS &&
        b.interests.every((i) => typeof i === "string" && i.length <= MAX_TEXT_LENGTH)))
  );
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "ai:generate-needs", RATE_RULES.ai);
  if (limited) return limited;

  try {
    const body = await req.json() as unknown;

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "Pflichtfelder fehlen: occasion, city, guests (> 0)" },
        { status: 400 }
      );
    }

    const input: NeedsPromptInput = {
      occasion:  body.occasion,
      city:      body.city,
      guests:    body.guests,
      budgetEur: body.budgetEur ?? null,
      interests: Array.isArray(body.interests) ? body.interests : [],
    };

    const client = getOpenAIClient();
    const resp = await client.responses.create({
      model: "gpt-5.2",
      instructions: EVENT_NEEDS_SYSTEM_PROMPT,
      input: buildNeedsPrompt(input),
    });

    const raw = (resp.output_text ?? "").trim();

    let parsed: NeedsResponse;
    try {
      parsed = JSON.parse(raw) as NeedsResponse;
    } catch {
      console.error("generate-needs: JSON parse failed", raw);
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden." },
        { status: 502 }
      );
    }

    // Sanitize: only keep valid slugs, deduplicate, cap at 8
    const needs = [...new Set(
      (Array.isArray(parsed.needs) ? parsed.needs : [])
        .filter((s): s is string => typeof s === "string" && VALID_NEED_SLUGS.has(s))
    )].slice(0, 8);

    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";

    if (needs.length === 0) {
      return NextResponse.json(
        { error: "KI hat keine gültigen Needs zurückgegeben." },
        { status: 502 }
      );
    }

    return NextResponse.json({ needs, reasoning });
  } catch (err) {
    console.error("generate-needs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
