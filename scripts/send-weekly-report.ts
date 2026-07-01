// send-weekly-report.ts
// =============================================================================
// Weekly Conversion-Funnel-Report per Email an den Betreiber.
// Berechnet die wichtigsten 5 KPIs der letzten 7 Tage vs Vorwoche, rendert
// eine HTML-Email im PerfectDay24-Look und verschickt via Resend.
//
// Nutzung:
//   npx tsx scripts/send-weekly-report.ts
//   npx tsx scripts/send-weekly-report.ts --to=ab@energieaudit365.de --dry-run
//
// Env-Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

const DEFAULT_TO = "ab@energieaudit365.de";
const SUBSCRIPTION_PRICE_CENTS: Record<string, number> = {
  partner_basic: 4900,
  partner_pro: 14900,
};

type Range = { fromIso: string; toIso: string; label: string };

type Metrics = {
  activeUsers: number;
  plansCreated: number;
  aiPlansApplied: number;
  aiPlansOpened: number;
  partnerClicks: number;
  mrrCents: number;
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentWeek(): Range {
  const to = new Date();
  to.setUTCHours(23, 59, 59, 999);
  return {
    fromIso: daysAgo(7).toISOString(),
    toIso: to.toISOString(),
    label: `${fmtDate(daysAgo(7))} bis ${fmtDate(to)}`,
  };
}

function previousWeek(): Range {
  const from = daysAgo(14);
  const to = daysAgo(7);
  to.setUTCMilliseconds(to.getUTCMilliseconds() - 1);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    label: `${fmtDate(from)} bis ${fmtDate(to)}`,
  };
}

async function countActiveUsers(sb: SupabaseClient, r: Range): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("attribution_events")
    .select("user_id")
    .gte("occurred_at", r.fromIso)
    .lte("occurred_at", r.toIso)
    .not("user_id", "is", null)
    .limit(50000);
  if (error) {
    console.warn("countActiveUsers:", error.message);
    return 0;
  }
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ user_id: string | null }>) {
    if (row.user_id) set.add(row.user_id);
  }
  return set.size;
}

async function countRows(sb: SupabaseClient, table: string, r: Range, timeField = "created_at"): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sb as any)
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(timeField, r.fromIso)
    .lte(timeField, r.toIso);
  if (error) {
    console.warn(`countRows(${table}):`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countEventType(sb: SupabaseClient, r: Range, eventType: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sb as any)
    .from("attribution_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("occurred_at", r.fromIso)
    .lte("occurred_at", r.toIso);
  if (error) {
    console.warn(`countEventType(${eventType}):`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function computeMrrCents(sb: SupabaseClient): Promise<number> {
  // Aktuelle MRR aus aktiven Partner-Subs. Kein Zeitfenster —
  // Snapshot zum Report-Zeitpunkt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("partner_profiles")
    .select("visibility_tier,billing_status")
    .in("billing_status", ["active", "trial", "manual"]);
  if (error) {
    console.warn("computeMrrCents:", error.message);
    return 0;
  }
  let cents = 0;
  for (const row of (data ?? []) as Array<{ visibility_tier: string; billing_status: string }>) {
    const price = SUBSCRIPTION_PRICE_CENTS[row.visibility_tier];
    if (typeof price === "number") cents += price;
  }
  return cents;
}

async function gatherMetrics(sb: SupabaseClient, r: Range, includeMrr: boolean): Promise<Metrics> {
  const [activeUsers, plansPlanner, plansEvent, aiApplied, aiOpened, clicks, mrr] = await Promise.all([
    countActiveUsers(sb, r),
    countRows(sb, "plans", r),
    countRows(sb, "event_plans", r),
    countEventType(sb, r, "ai_plan_applied"),
    countEventType(sb, r, "ai_plan_open"),
    countEventType(sb, r, "click"),
    includeMrr ? computeMrrCents(sb) : Promise.resolve(0),
  ]);
  return {
    activeUsers,
    plansCreated: plansPlanner + plansEvent,
    aiPlansApplied: aiApplied,
    aiPlansOpened: aiOpened,
    partnerClicks: clicks,
    mrrCents: mrr,
  };
}

function deltaFragment(current: number, prev: number): string {
  if (prev === 0 && current === 0) return "±0";
  if (prev === 0) return `+${current}`;
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "±";
  const color = diff > 0 ? "#188c50" : diff < 0 ? "#b32d3f" : "#8b7767";
  const sign = diff > 0 ? "+" : "";
  return `<span style="color:${color};font-weight:600">${arrow} ${sign}${diff} · ${sign}${pct}%</span>`;
}

function euroFromCents(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`;
}

function renderEmail(current: Metrics, previous: Metrics, thisWeek: Range, lastWeek: Range): string {
  const aiConversion =
    current.aiPlansOpened > 0
      ? Math.round((current.aiPlansApplied / current.aiPlansOpened) * 100)
      : 0;

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>PerfectDay24 · Wochenreport</title></head>
<body style="font-family:system-ui,sans-serif;background:#f7f4ee;margin:0;padding:32px 16px">
  <div style="max-width:620px;margin:0 auto;background:#fffdf8;border-radius:20px;padding:32px;border:1px solid rgba(23,23,23,0.08)">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#b76a43;margin-bottom:8px">
      PerfectDay24 · Wochenreport
    </div>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#171717">
      Woche ${thisWeek.label}
    </h1>
    <p style="color:#665d55;margin:0 0 24px;font-size:14px">
      Vergleich zur Vorwoche (${lastWeek.label}).
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${[
        { label: "Aktive Nutzer (WAU)", current: current.activeUsers, prev: previous.activeUsers, hint: "Distinct user_ids mit Attribution-Signal" },
        { label: "Pläne erstellt", current: current.plansCreated, prev: previous.plansCreated, hint: "Planner + Event-Pläne" },
        { label: "AI-Pläne übernommen", current: current.aiPlansApplied, prev: previous.aiPlansApplied, hint: `Öffnungen: ${current.aiPlansOpened} · Conv-Rate: ${aiConversion}%` },
        { label: "Affiliate-/Partner-Klicks", current: current.partnerClicks, prev: previous.partnerClicks, hint: "monetization_track event_type=click" },
      ]
        .map(
          (row) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid rgba(23,23,23,0.06);width:60%">
          <div style="font-size:14px;font-weight:600;color:#171717">${row.label}</div>
          <div style="font-size:11px;color:#8b7767;margin-top:2px">${row.hint}</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid rgba(23,23,23,0.06);text-align:right;width:20%">
          <div style="font-size:22px;font-weight:700;color:#171717">${row.current.toLocaleString("de-DE")}</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid rgba(23,23,23,0.06);text-align:right;width:20%;font-size:12px">
          ${deltaFragment(row.current, row.prev)}
        </td>
      </tr>`
        )
        .join("")}
      <tr>
        <td style="padding:14px 0">
          <div style="font-size:14px;font-weight:600;color:#171717">MRR (Snapshot)</div>
          <div style="font-size:11px;color:#8b7767;margin-top:2px">Aktive Partner × Preis-Tier</div>
        </td>
        <td style="padding:14px 0;text-align:right">
          <div style="font-size:22px;font-weight:700;color:#171717">${euroFromCents(current.mrrCents)}</div>
        </td>
        <td style="padding:14px 0;text-align:right;font-size:12px;color:#8b7767">
          nur aktuell
        </td>
      </tr>
    </table>

    <div style="background:#f0ede7;border-radius:12px;padding:16px 20px;margin-top:20px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8b7767;margin-bottom:6px">Fokus-Hinweis</div>
      <div style="font-size:14px;color:#171717;line-height:1.5">
        ${current.aiPlansApplied === 0 && current.aiPlansOpened > 0
          ? `AI-Plans wurden ${current.aiPlansOpened}× geöffnet, aber 0× übernommen — Qualitäts-Check der Vorschläge nötig.`
          : current.aiPlansOpened === 0
            ? "Kein AI-Plan-Traffic diese Woche. Ist der Button noch prominent im Planner?"
            : `Conversion "AI öffnen → übernehmen": ${aiConversion}%. Bei &lt;10% Prompts, Vibe-Tags oder Qualität nachschärfen.`}
      </div>
    </div>

    <p style="margin:32px 0 0;font-size:11px;color:#8b7767;line-height:1.5">
      Automatisch erstellt via <code style="background:#f0ede7;padding:2px 6px;border-radius:4px">scripts/send-weekly-report.ts</code>.
      Datenquelle: monetization_track, plans, event_plans, partner_profiles.
    </p>
  </div>
</body>
</html>`;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));

  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args.set(m[1], m[2] ?? "true");
  }
  const to = args.get("to") ?? DEFAULT_TO;
  const dryRun = args.get("dry-run") === "true";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  if (!dryRun && !resendKey) throw new Error("RESEND_API_KEY missing (or use --dry-run)");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const thisWeek = currentWeek();
  const lastWeek = previousWeek();

  console.log(`Sammle Metriken für ${thisWeek.label}…`);
  const [current, previous] = await Promise.all([
    gatherMetrics(sb, thisWeek, true),
    gatherMetrics(sb, lastWeek, false),
  ]);

  console.log("Current:", current);
  console.log("Previous:", previous);

  const html = renderEmail(current, previous, thisWeek, lastWeek);
  const subject = `PerfectDay24 · Wochenreport ${thisWeek.label} · ${current.plansCreated} Pläne · ${current.activeUsers} Nutzer`;

  if (dryRun) {
    console.log("\n--- DRY-RUN Email HTML (erste 800 Zeichen) ---");
    console.log(html.slice(0, 800));
    console.log("---\nSubject:", subject);
    console.log("\nWird NICHT gesendet.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PerfectDay24 Reports <reports@perfectday24.de>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  console.log(`Sent to ${to}. Resend-ID:`, json.id ?? "(none)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
