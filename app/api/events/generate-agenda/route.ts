// app/api/events/generate-agenda/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { EVENT_AGENDA_SYSTEM_PROMPT } from "@/lib/ai/event-system-prompt";
import { buildAgendaPrompt } from "@/lib/ai/event-prompts";
import type { AgendaPromptInput, BookingItem } from "@/lib/ai/event-prompts";

export const runtime = "nodejs";

type RequestBody = {
  occasion: string;
  city: string;
  guests: number;
  eventDate?: string | null;
  budgetEur?: number | null;
  bookings: BookingItem[];
};

type AgendaResponse = {
  agendaText: string;
  tipsText: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY fehlt");
  return new OpenAI({ apiKey });
}

function validateBody(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.occasion === "string" && b.occasion.length > 0 &&
    typeof b.city === "string" && b.city.length > 0 &&
    typeof b.guests === "number" && b.guests > 0 &&
    Array.isArray(b.bookings)
  );
}

function validateBookingItem(item: unknown): item is BookingItem {
  if (!item || typeof item !== "object") return false;
  const b = item as Record<string, unknown>;
  return (
    typeof b.needSlug === "string" &&
    typeof b.needLabel === "string" &&
    typeof b.providerName === "string" &&
    typeof b.packageName === "string" &&
    typeof b.priceEur === "number" &&
    (b.priceUnit === "total" || b.priceUnit === "per_person")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown;

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "Pflichtfelder fehlen: occasion, city, guests (> 0), bookings (Array)" },
        { status: 400 }
      );
    }

    const bookings: BookingItem[] = body.bookings
      .filter(validateBookingItem)
      .map((b) => ({
        needSlug:           b.needSlug,
        needLabel:          b.needLabel,
        providerName:       b.providerName,
        packageName:        b.packageName,
        packageDescription: typeof b.packageDescription === "string" ? b.packageDescription : null,
        priceEur:           b.priceEur,
        priceUnit:          b.priceUnit,
      }));

    const input: AgendaPromptInput = {
      occasion:  body.occasion,
      city:      body.city,
      guests:    body.guests,
      eventDate: body.eventDate ?? null,
      budgetEur: body.budgetEur ?? null,
      bookings,
    };

    const client = getOpenAIClient();
    const resp = await client.responses.create({
      model: "gpt-5.2",
      instructions: EVENT_AGENDA_SYSTEM_PROMPT,
      input: buildAgendaPrompt(input),
    });

    const raw = (resp.output_text ?? "").trim();

    let parsed: AgendaResponse;
    try {
      parsed = JSON.parse(raw) as AgendaResponse;
    } catch {
      console.error("generate-agenda: JSON parse failed", raw);
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden." },
        { status: 502 }
      );
    }

    const agendaText = typeof parsed.agendaText === "string" ? parsed.agendaText.trim() : "";
    const tipsText   = typeof parsed.tipsText   === "string" ? parsed.tipsText.trim()   : "";

    if (!agendaText) {
      return NextResponse.json(
        { error: "KI hat keinen Agenda-Text zurückgegeben." },
        { status: 502 }
      );
    }

    return NextResponse.json({ agendaText, tipsText });
  } catch (err) {
    console.error("generate-agenda error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
