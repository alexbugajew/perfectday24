import { NextResponse } from "next/server";
import { recordMonetizationEvent, type MonetizationTrackInput } from "@/lib/monetization/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MonetizationTrackInput;

    if (!body?.eventType) {
      return NextResponse.json({ error: "eventType fehlt" }, { status: 400 });
    }

    const result = await recordMonetizationEvent(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Monetization track failed:", error);
    return NextResponse.json({ ok: false, error: "tracking_failed" }, { status: 500 });
  }
}
