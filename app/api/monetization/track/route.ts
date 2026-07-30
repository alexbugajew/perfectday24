import { NextResponse } from "next/server";
import { recordMonetizationEvent, type MonetizationTrackInput } from "@/lib/monetization/server";
import { ATTRIBUTION_EVENT_TYPES } from "@/lib/monetization/types";
import { getSessionUserId } from "@/lib/security/session";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

/**
 * Tracking-Endpunkt für Attributions-Events.
 *
 * Der Endpunkt bleibt für anonyme Besucher offen — Impressions und Klicks
 * entstehen zwangsläufig ohne Login. Gehärtet wurde stattdessen, *was* der
 * Client bestimmen darf:
 *   - `userId` kommt aus der Session, nie aus dem Body
 *   - `revenueCents` wird ignoriert (Umsatz entsteht nur aus Stripe-Events)
 *   - `eventType` muss aus der bekannten Liste stammen
 *   - `creatorProfileId` löst hier keine Rewards mehr aus (siehe server.ts)
 *   - Rate-Limit pro IP
 */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "monetization:track", RATE_RULES.write);
  if (limited) return limited;

  try {
    const body = (await req.json()) as MonetizationTrackInput;

    if (!body?.eventType) {
      return NextResponse.json({ error: "eventType fehlt" }, { status: 400 });
    }

    if (!ATTRIBUTION_EVENT_TYPES.includes(body.eventType)) {
      return NextResponse.json({ error: "eventType ungültig" }, { status: 400 });
    }

    // Identität ausschließlich serverseitig bestimmen.
    const sessionUserId = await getSessionUserId();

    const result = await recordMonetizationEvent({
      ...body,
      userId: sessionUserId,
      revenueCents: null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Monetization track failed:", error);
    return NextResponse.json({ ok: false, error: "tracking_failed" }, { status: 500 });
  }
}
