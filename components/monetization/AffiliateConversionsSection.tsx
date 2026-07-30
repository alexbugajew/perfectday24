// Admin-Section fuer Affiliate-Conversions.
// Server-Component. Zeigt Netzwerk-Totals + Recent Conversions.

import { createClient } from "@supabase/supabase-js";

type ConvRow = {
  id: string;
  click_id: string;
  network: string;
  affiliate_link_id: string | null;
  partner_profile_id: string | null;
  network_order_id: string | null;
  gross_amount_cents: number | null;
  commission_cents: number | null;
  currency: string | null;
  status: string;
  received_at: string;
  approved_at: string | null;
};

function euros(cents: number | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`;
}

const NETWORK_LABEL: Record<string, string> = {
  awin: "Awin",
  tradedoubler: "Tradedoubler",
  booking: "Booking.com",
  direct: "Direktpartner",
  other: "Sonstige",
};

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "rgba(196,137,79,0.14)", text: "#a45326" },
  approved: { label: "Approved", bg: "rgba(24,140,80,0.14)", text: "#166534" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.14)", text: "#b91c1c" },
  cancelled: { label: "Cancelled", bg: "rgba(23,23,23,0.06)", text: "#6b6b6b" },
};

export default async function AffiliateConversionsSection() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("affiliate_conversions")
    .select("id,click_id,network,affiliate_link_id,partner_profile_id,network_order_id,gross_amount_cents,commission_cents,currency,status,received_at,approved_at")
    .order("received_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] pd24-status-error p-5 text-sm">
        Affiliate-Conversion-Query fehlgeschlagen: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as ConvRow[];

  const byNetwork = new Map<string, { count: number; approved_cents: number; pending_cents: number }>();
  for (const row of rows) {
    const key = row.network || "other";
    const entry = byNetwork.get(key) ?? { count: 0, approved_cents: 0, pending_cents: 0 };
    entry.count += 1;
    if (row.status === "approved") entry.approved_cents += row.commission_cents ?? 0;
    else if (row.status === "pending") entry.pending_cents += row.commission_cents ?? 0;
    byNetwork.set(key, entry);
  }

  const networkEntries = Array.from(byNetwork.entries()).sort(
    (a, b) => b[1].approved_cents - a[1].approved_cents
  );

  return (
    <div className="space-y-4">
      {networkEntries.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {networkEntries.map(([network, stats]) => (
            <div key={network} className="rounded-[var(--radius-card-sm)] border border-black/5 bg-[var(--bg-panel)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {NETWORK_LABEL[network] ?? network}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                {euros(stats.approved_cents)}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {stats.count} Conversions · {euros(stats.pending_cents)} pending
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white p-8 text-sm text-[var(--text-muted)]">
          <div className="mb-2 font-medium text-[var(--text-strong)]">Noch keine Conversions.</div>
          <div>
            Sobald Netzwerke Postbacks auf <code>/api/affiliate/postback/&lt;network&gt;</code> senden,
            erscheinen sie hier. Configure Postback-URL pro Netzwerk:
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            <li>
              <strong>Awin:</strong>{" "}
              <code>{"/api/affiliate/postback/awin?click_id={awc}&order_id={commissionRef}&amount={totalAmount}&currency={currency}&status={commissionStatus}&pd24_secret=<SECRET>"}</code>
            </li>
            <li>
              <strong>Tradedoubler:</strong>{" "}
              <code>{"/api/affiliate/postback/tradedoubler?click_id={epi}&order_id={reportingID}&amount={orderValue}&currency={currency}&pd24_secret=<SECRET>"}</code>
            </li>
            <li>
              <strong>Booking:</strong> CSV-Import via API/Feed (kein Live-Postback)
            </li>
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--bg-panel)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3">Empfangen</th>
                <th className="px-4 py-3">Netzwerk</th>
                <th className="px-4 py-3">Click-ID</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3 text-right">Auftrag</th>
                <th className="px-4 py-3 text-right">Provision</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((row) => {
                const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending;
                return (
                  <tr key={row.id} className="border-t border-[var(--line-subtle)]">
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {new Date(row.received_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-strong)]">
                      {NETWORK_LABEL[row.network] ?? row.network}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--text-muted)]">{row.click_id}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--text-muted)]">
                      {row.network_order_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-strong)]">
                      {euros(row.gross_amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-strong)]">
                      {euros(row.commission_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: st.bg, color: st.text }}
                      >
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 40 ? (
            <div className="border-t border-[var(--line-subtle)] bg-[var(--bg-panel)] px-4 py-2.5 text-xs text-[var(--text-muted)]">
              Zeige neueste 40 von {rows.length} Eintraegen.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
