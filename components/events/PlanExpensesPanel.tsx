"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TargetType = "event_plan" | "roadtrip" | "route";

type PlanExpense = {
  id: string;
  target_type: TargetType;
  target_id: string;
  stop_index: number | null;
  label: string;
  amount_cents: number;
  paid_by_label: string | null;
  equal_split: boolean;
  notes: string | null;
  created_at: string;
};

type Props = {
  /** Polymorphic target. Default 'event_plan' für Backwards-Kompatibilität. */
  targetType?: TargetType;
  targetId: string;
  /** Deprecated — wenn übergeben wird targetType='event_plan' angenommen. */
  planId?: string;
  participantCount?: number;
  participantLabels?: string[];
};

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * Minimal Expense-Splitting Panel. Stub-Version:
 * - Liste der Ausgaben pro Plan
 * - "Hinzufügen" mit Label + Betrag + paid_by
 * - Summe + Pro-Person-Anteil bei equal_split
 *
 * Erweiterungen für später: pro-Stop-Zuordnung, custom Splits,
 * Saldo-Übersicht "Wer schuldet wem wie viel".
 */
export default function PlanExpensesPanel({
  targetType,
  targetId,
  planId,
  participantCount = 1,
  participantLabels = [],
}: Props) {
  // Resolve target. Old API (planId) → event_plan. New API (targetType+targetId) wins.
  const resolvedType: TargetType = targetType ?? "event_plan";
  const resolvedId = targetId ?? planId ?? "";

  const [expenses, setExpenses] = useState<PlanExpense[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!resolvedId) {
      setExpenses([]);
      return;
    }
    (async () => {
      const { data, error: e } = await supabase
        .from("plan_expenses")
        .select("*")
        .eq("target_type", resolvedType)
        .eq("target_id", resolvedId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (e) {
        setExpenses([]);
        return;
      }
      setExpenses((data ?? []) as PlanExpense[]);
    })();
    return () => {
      active = false;
    };
  }, [resolvedType, resolvedId]);

  const total = useMemo(() => {
    if (!expenses) return 0;
    return expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  }, [expenses]);

  const perPerson = participantCount > 0 ? Math.round(total / participantCount) : 0;

  async function handleAdd() {
    const amount = Number(amountStr.replace(",", ".")) * 100;
    if (!label.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Bitte Label und Betrag eintragen.");
      return;
    }
    setSaving(true);
    setError(null);
    const insertPayload: Record<string, unknown> = {
      target_type: resolvedType,
      target_id: resolvedId,
      label: label.trim(),
      amount_cents: Math.round(amount),
      paid_by_label: paidBy.trim() || null,
      equal_split: true,
    };
    // Für Backwards-Compat: plan_id setzen wenn event_plan (Legacy-Spalte ist
    // nullable, aber Constraints in alten Migrations könnten sie erwarten).
    if (resolvedType === "event_plan") {
      insertPayload.plan_id = resolvedId;
    }
    const { data, error: e } = await supabase
      .from("plan_expenses")
      .insert(insertPayload)
      .select()
      .single();
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    if (data) setExpenses((prev) => [...(prev ?? []), data as PlanExpense]);
    setLabel("");
    setAmountStr("");
    setPaidBy("");
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const { error: e } = await supabase.from("plan_expenses").delete().eq("id", id);
    if (e) return;
    setExpenses((prev) => prev?.filter((x) => x.id !== id) ?? null);
  }

  if (expenses === null) {
    return (
      <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 text-xs text-[var(--text-muted)]">
        Ausgaben werden geladen …
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Kosten teilen
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-lg">
            Ausgaben für diesen Plan
          </h3>
        </div>
        {!adding && expenses.length > 0 ? (
          <div className="text-right">
            <div className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">
              {formatEuro(total)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {participantCount > 1 ? `${formatEuro(perPerson)} pro Person` : "Gesamt"}
            </div>
          </div>
        ) : null}
      </div>

      {expenses.length === 0 && !adding ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 text-center">
          <div className="text-sm text-[var(--text-muted)]">Noch keine Ausgaben erfasst.</div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Erste Ausgabe hinzufügen
          </button>
        </div>
      ) : null}

      {expenses.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--line-subtle)]">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-[var(--text-strong)]">{e.label}</div>
                {e.paid_by_label ? (
                  <div className="text-xs text-[var(--text-muted)]">bezahlt von {e.paid_by_label}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-[var(--text-strong)]">{formatEuro(e.amount_cents)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  aria-label="Ausgabe löschen"
                  className="text-[var(--text-muted)] transition hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. Dinner Hofbräuhaus"
            className="w-full rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--text-strong)]"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Betrag €"
              inputMode="decimal"
              className="rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--text-strong)]"
            />
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--text-strong)]"
            >
              <option value="">Wer hat gezahlt? (optional)</option>
              {participantLabels.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Gemeinschaftskasse">Gemeinschaftskasse</option>
            </select>
          </div>
          {error ? <div className="text-xs text-rose-600">{error}</div> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 rounded-lg bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Speichere…" : "Hinzufügen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-muted)]"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : expenses.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex min-h-9 items-center rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
        >
          + Weitere Ausgabe
        </button>
      ) : null}

      <div className="mt-4 rounded-lg border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[11px] leading-5 text-[var(--text-muted)]">
        <strong>Hinweis (Stub):</strong> Aktuell gleicher Anteil pro Person. Custom-Splits, Schuldner-Übersicht
        und Belege folgen in der nächsten Iteration. Schema migration: <code>plan_expenses</code>.
      </div>
    </div>
  );
}
