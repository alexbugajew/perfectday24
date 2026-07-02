// Admin-Section fuer Event-Provisionen.
// Wird von /admin/monetization gerendert (Server-Component).

import { createClient } from "@supabase/supabase-js";

type CommissionRow = {
  id: string;
  quote_id: string;
  provider_id: string | null;
  partner_profile_id: string | null;
  need_slug: string | null;
  city_slug: string | null;
  event_date: string | null;
  base_amount_cents: number;
  rate_bps: number;
  commission_cents: number;
  status: string;
  earned_at: string;
  invoiced_at: string | null;
  paid_at: string | null;
};

type Totals = {
  earned: number;
  invoiced: number;
  paid: number;
  cancelled: number;
  count: number;
};

function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`;
}

function statusStyle(status: string): { label: string; bg: string; text: string } {
  switch (status) {
    case "earned":
      return { label: "Offen", bg: "rgba(196,137,79,0.14)", text: "#a45326" };
    case "invoiced":
      return { label: "Fakturiert", bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" };
    case "paid":
      return { label: "Bezahlt", bg: "rgba(24,140,80,0.14)", text: "#166534" };
    case "cancelled":
      return { label: "Storniert", bg: "rgba(23,23,23,0.06)", text: "#6b6b6b" };
    case "waived":
      return { label: "Erlassen", bg: "rgba(23,23,23,0.06)", text: "#6b6b6b" };
    default:
      return { label: status, bg: "rgba(23,23,23,0.06)", text: "#6b6b6b" };
  }
}

export default async function EventCommissionsSection() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("event_commissions")
    .select("id,quote_id,provider_id,partner_profile_id,need_slug,city_slug,event_date,base_amount_cents,rate_bps,commission_cents,status,earned_at,invoiced_at,paid_at")
    .order("earned_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Provisions-Query fehlgeschlagen: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as CommissionRow[];
  const totals: Totals = { earned: 0, invoiced: 0, paid: 0, cancelled: 0, count: rows.length };
  for (const row of rows) {
    if (row.status === "earned") totals.earned += row.commission_cents;
    else if (row.status === "invoiced") totals.invoiced += row.commission_cents;
    else if (row.status === "paid") totals.paid += row.commission_cents;
    else if (row.status === "cancelled" || row.status === "waived") totals.cancelled += row.commission_cents;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-[rgba(196,137,79,0.24)] bg-[rgba(255,249,241,0.72)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#a45326]">Offen (earned)</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{euros(totals.earned)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Faellige Provisionen, noch nicht faktiert.</div>
        </div>
        <div className="rounded-[20px] border border-[rgba(59,130,246,0.18)] bg-[rgba(219,234,254,0.36)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#1d4ed8]">Fakturiert</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{euros(totals.invoiced)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Rechnung raus, Zahlung offen.</div>
        </div>
        <div className="rounded-[20px] border border-[rgba(24,140,80,0.22)] bg-[rgba(230,246,236,0.48)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Bezahlt</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{euros(totals.paid)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Realized Revenue aus Event-Vermittlung.</div>
        </div>
        <div className="rounded-[20px] border border-black/5 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Datensaetze</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totals.count}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Letzte 200 accepted-Quotes.</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-8 text-center text-sm text-[var(--text-muted)]">
          Noch keine akzeptierten Angebote → keine Provisionen. Sobald ein Vendor-Quote auf status=accepted geht, entsteht hier automatisch ein Eintrag.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--bg-panel)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3">Earned at</th>
                <th className="px-4 py-3">Stadt</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Need</th>
                <th className="px-4 py-3 text-right">Auftragswert</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Provision</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((row) => {
                const st = statusStyle(row.status);
                return (
                  <tr key={row.id} className="border-t border-[var(--line-subtle)]">
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {new Date(row.earned_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{row.city_slug ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {row.event_date
                        ? new Date(row.event_date).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-strong)]">{row.need_slug ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-strong)]">{euros(row.base_amount_cents)}</td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">{(row.rate_bps / 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-strong)]">{euros(row.commission_cents)}</td>
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
              Zeige neueste 40 von {rows.length} Eintraegen. Status-Aenderungen aktuell direkt in Supabase Studio via UPDATE event_commissions SET status='invoiced' | 'paid' WHERE id=…
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
