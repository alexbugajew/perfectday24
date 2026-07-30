// Affiliate-Postback-Endpoint
// ============================================================================
// Netzwerke pingen diese URL wenn eine Conversion stattgefunden hat.
// Wir normalisieren die Payload und speichern in affiliate_conversions.
//
// URLs (bei Netzwerken zu konfigurieren):
//   Awin S2S:         /api/affiliate/postback/awin?click_id={awc}&order_id={commissionRef}&amount={totalAmount}&currency={currency}&status={commissionStatus}&pd24_secret={SECRET}
//   Tradedoubler S2S: /api/affiliate/postback/tradedoubler?click_id={epi}&order_id={reportingID}&amount={orderValue}&currency={currency}&status={status}&pd24_secret={SECRET}
//   Booking (manuell/CSV upload): POST body im Bulk moeglich, gleiche Felder
//
// Security: Shared Secret gegen env AFFILIATE_POSTBACK_SECRET.
//   - Bevorzugt im Header `X-PD24-Postback-Secret` (landet nicht in Access-Logs)
//   - Query-Parameter `pd24_secret` bleibt als Fallback, weil manche Netzwerke
//     keine eigenen Header senden können
//   - Fehlt das Secret in der Umgebung, wird der Endpunkt geschlossen
//     (fail-closed) statt die Prüfung zu überspringen

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

const VALID_NETWORKS = new Set(["awin", "tradedoubler", "booking", "direct", "other"]);

const POSTBACK_SECRET_HEADER = "x-pd24-postback-secret";

/** Längenunabhängiger, konstantzeitiger Vergleich zweier Secrets. */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function readParam(url: URL, key: string, alt?: string): string | null {
  const primary = url.searchParams.get(key);
  if (primary && primary.trim()) return primary.trim();
  if (alt) {
    const secondary = url.searchParams.get(alt);
    if (secondary && secondary.trim()) return secondary.trim();
  }
  return null;
}

function normalizeStatus(raw: string | null): "pending" | "approved" | "rejected" | "cancelled" {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (["approved", "confirmed", "valid", "accepted", "paid"].includes(s)) return "approved";
  if (["rejected", "declined", "invalid"].includes(s)) return "rejected";
  if (["cancelled", "canceled", "refunded", "returned"].includes(s)) return "cancelled";
  return "pending";
}

function parseAmountCents(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

async function handlePostback(
  req: Request,
  network: string,
  payload: Record<string, unknown>
) {
  if (!VALID_NETWORKS.has(network)) {
    return NextResponse.json({ error: "unknown_network" }, { status: 400 });
  }

  const requestUrl = new URL(req.url);

  // Fail-closed: ohne konfiguriertes Secret nimmt der Endpunkt nichts an.
  // Vorher entfiel die Prüfung komplett, wenn die Env-Var fehlte — damit
  // konnte jeder Provisionsdatensätze mit status=approved einschleusen.
  const expectedSecret = process.env.AFFILIATE_POSTBACK_SECRET;
  if (!expectedSecret) {
    console.error("[postback] AFFILIATE_POSTBACK_SECRET ist nicht gesetzt — Endpunkt geschlossen.");
    return NextResponse.json({ error: "postback_not_configured" }, { status: 503 });
  }

  const providedSecret =
    req.headers.get(POSTBACK_SECRET_HEADER)?.trim() || readParam(requestUrl, "pd24_secret");

  if (!secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clickId = readParam(requestUrl, "click_id");
  if (!clickId) {
    return NextResponse.json({ error: "missing_click_id" }, { status: 400 });
  }

  const orderId = readParam(requestUrl, "order_id", "orderId");
  const amount = parseAmountCents(readParam(requestUrl, "amount", "gross_amount"));
  const commissionAmount = parseAmountCents(readParam(requestUrl, "commission", "commission_amount"));
  const currency = readParam(requestUrl, "currency") ?? "EUR";
  const status = normalizeStatus(readParam(requestUrl, "status"));
  const networkClickRef = readParam(requestUrl, "network_click_ref", "click_ref");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Klick in attribution_events finden ueber metadata.click_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clickRow } = await (supabase as any)
    .from("attribution_events")
    .select("id,affiliate_link_id,partner_profile_id")
    .filter("metadata->>click_id", "eq", clickId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  const insertPayload = {
    click_id: clickId,
    network,
    affiliate_link_id: clickRow?.affiliate_link_id ?? null,
    partner_profile_id: clickRow?.partner_profile_id ?? null,
    network_click_ref: networkClickRef,
    network_order_id: orderId,
    gross_amount_cents: amount,
    commission_cents: commissionAmount,
    currency,
    status,
    raw_payload: {
      ...Object.fromEntries(requestUrl.searchParams.entries()),
      ...payload,
    },
    received_at: nowIso,
    approved_at: status === "approved" ? nowIso : null,
    rejected_at: status === "rejected" ? nowIso : null,
  };

  // Upsert bei click_id + order_id (dedup).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("affiliate_conversions")
    .upsert(insertPayload, { onConflict: "click_id,network_order_id" });

  if (error) {
    console.error("[postback]", network, error);
    // Interne DB-Fehlermeldungen nicht nach außen geben.
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, network, click_id: clickId, status });
}

// Netzwerke bevorzugen GET (Pixel-Style) oder POST (S2S) — beides erlaubt.
export async function GET(req: Request, ctx: { params: Promise<{ network: string }> }) {
  const limited = enforceRateLimit(req, "affiliate:postback", RATE_RULES.write);
  if (limited) return limited;
  const { network } = await ctx.params;
  return handlePostback(req, network, {});
}

export async function POST(req: Request, ctx: { params: Promise<{ network: string }> }) {
  const limited = enforceRateLimit(req, "affiliate:postback", RATE_RULES.write);
  if (limited) return limited;
  const { network } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return handlePostback(req, network, body);
}
