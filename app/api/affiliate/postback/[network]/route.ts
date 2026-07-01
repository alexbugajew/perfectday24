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
// Security: pd24_secret query param prueft gegen env AFFILIATE_POSTBACK_SECRET.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_NETWORKS = new Set(["awin", "tradedoubler", "booking", "direct", "other"]);

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
  const expectedSecret = process.env.AFFILIATE_POSTBACK_SECRET;
  const providedSecret = readParam(requestUrl, "pd24_secret");
  if (expectedSecret && providedSecret !== expectedSecret) {
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
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, network, click_id: clickId, status });
}

// Netzwerke bevorzugen GET (Pixel-Style) oder POST (S2S) — beides erlaubt.
export async function GET(req: Request, ctx: { params: Promise<{ network: string }> }) {
  const { network } = await ctx.params;
  return handlePostback(req, network, {});
}

export async function POST(req: Request, ctx: { params: Promise<{ network: string }> }) {
  const { network } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return handlePostback(req, network, body);
}
