// Premium-Vormerkung im Vorstart-Modus (s. lib/premium/prelaunch.ts).
// ============================================================================
// Solange Stripe nicht live ist, sammelt dieser Endpunkt Upgrade-Interesse
// als attribution_event ein — die Vormerker werden am HRB-Tag per Mail
// eingeladen. Kein DDL nötig: Der Check-Constraint der Tabelle kennt nur die
// 17 bestehenden Typen (Lehre vom 30.07.: unbekannter Typ → 23514 in Prod),
// deshalb läuft die Vormerkung als event_type "lead" mit
// metadata.kind = "premium_waitlist". Abfrage der Vormerker:
//   event_type=eq.lead & surface=eq.upgrade_modal
// Idempotent: pro Nutzer zählt eine Vormerkung.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestUserId } from "@/lib/security/session";
import { PREMIUM_PRELAUNCH } from "@/lib/premium/prelaunch";

export const runtime = "nodejs";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase-Service-Credentials fehlen");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  if (!PREMIUM_PRELAUNCH) {
    // Nach dem Stripe-Cutover gibt es nichts mehr vorzumerken.
    return NextResponse.json({ error: "Premium ist bereits verfügbar." }, { status: 409 });
  }

  const userId = await getRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
  }

  let interval = "month";
  try {
    const body = (await req.json()) as { interval?: unknown };
    if (body.interval === "year") interval = "year";
  } catch {
    // Ohne Body zählt die Vormerkung fürs Monatsabo.
  }

  const supabase = getServiceClient();

  const { data: existing, error: readError } = await supabase
    .from("attribution_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "lead")
    .eq("surface", "upgrade_modal")
    .limit(1);
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if ((existing ?? []).length > 0) {
    return NextResponse.json({ ok: true, alreadyListed: true });
  }

  const { error: insertError } = await supabase.from("attribution_events").insert({
    user_id: userId,
    event_type: "lead",
    surface: "upgrade_modal",
    metadata: { kind: "premium_waitlist", interval },
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyListed: false });
}
