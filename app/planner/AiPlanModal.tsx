"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannedStop } from "@/lib/planner";
import { generateAiPlan } from "@/lib/ai-planner/client";
import { formatPlannerTime } from "./helpers";

export type AiPlanContext = {
  citySlug: string | null;
  cityLabel?: string | null;
  planDate?: string;
  budget?: string;
  occasion?: string | null;
  startPointLabel?: string | null;
  startPointLat?: number | null;
  startPointLng?: number | null;
  interests?: string[];
  stopsCount?: number;
  familyAgeBand?: string | null;
  groupEnabled?: boolean;
  groupSize?: number;
};

type Props = AiPlanContext & {
  open: boolean;
  onClose: () => void;
  /** Wird gerufen wenn der User den AI-Plan übernimmt. */
  onApply: (stops: PlannedStop[], summary: string, prompt: string) => void;
  /** Optional: Telemetrie-Hooks fürs Funnel-Tracking. */
  onOpen?: () => void;
  onGenerated?: (stopCount: number) => void;
};

const OCCASION_LABELS: Record<string, string> = {
  date: "Date",
  family: "Familie",
  friends: "Freunde",
  tourism: "Tourismus",
  party: "Party",
  solo: "Solo",
  work: "Business",
};

const EXAMPLE_PROMPTS = [
  "Date-Abend mit Konzert und Drinks danach",
  "Familientag mit Museum, Park und kinderfreundlichem Lunch",
  "Wochenende mit Freunden, sportlich und ein guter Burger",
  "Solo-Tag mit Café, Galerie und Bar am Abend",
];

export default function AiPlanModal({
  open,
  citySlug,
  cityLabel,
  planDate,
  budget,
  occasion,
  startPointLabel,
  startPointLat,
  startPointLng,
  interests,
  stopsCount,
  familyAgeBand,
  groupEnabled,
  groupSize,
  onClose,
  onApply,
  onOpen,
  onGenerated,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ summary: string; stops: PlannedStop[]; prompt: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      onOpen?.();
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setPrompt("");
      setPreview(null);
      setError(null);
      setLoading(false);
      abortRef.current?.abort();
    }
  }, [open]);

  async function handleGenerate() {
    if (!citySlug) {
      setError("Wähle erst eine Stadt.");
      return;
    }
    const cleaned = prompt.trim();
    if (cleaned.length < 5) {
      setError("Beschreib deinen Wunsch etwas konkreter.");
      return;
    }
    setError(null);
    setPreview(null);
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await generateAiPlan({
        prompt: cleaned,
        citySlug,
        planDate,
        budget,
        occasion: occasion ?? undefined,
        startPointLabel: startPointLabel ?? undefined,
        startPointLat: startPointLat ?? undefined,
        startPointLng: startPointLng ?? undefined,
        interests: interests && interests.length > 0 ? interests : undefined,
        stopsCount,
        familyAgeBand: familyAgeBand ?? undefined,
        groupEnabled,
        groupSize,
        signal: ac.signal,
      });
      setPreview({ summary: result.summary, stops: result.stops, prompt: cleaned });
      onGenerated?.(result.stops.length);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "AI-Plan fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!preview) return;
    onApply(preview.stops, preview.summary, preview.prompt);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-end bg-black/45 sm:items-center sm:p-4">
      <div className="flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-2xl sm:rounded-2xl">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--bg-panel)]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-subtle)] px-5 pb-3 pt-4 sm:px-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-warm)]">
              Autopilot · AI
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)]">
              Schreib deinen Tag — in einem Satz.
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              AI baut den Plan mit echten Locations und Events aus unserer Datenbank.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 rounded-full border border-[var(--line-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Schließen
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {!preview ? (
            <>
              {/* Constraints aus dem Formular — was die AI mitnutzt */}
              {(() => {
                const chips: string[] = [];
                if (cityLabel) chips.push(cityLabel);
                else if (citySlug) chips.push(citySlug);
                if (startPointLabel) chips.push(`ab ${startPointLabel}`);
                if (occasion) chips.push(`Anlass: ${OCCASION_LABELS[occasion] ?? occasion}`);
                if (familyAgeBand && occasion === "family") chips.push(`Alter: ${familyAgeBand}`);
                if (interests && interests.length > 0) chips.push(`${interests.length} Interesse${interests.length === 1 ? "" : "n"}`);
                if (typeof stopsCount === "number" && stopsCount > 0) chips.push(`${stopsCount} Stops`);
                if (planDate) chips.push(planDate);
                if (groupEnabled && typeof groupSize === "number" && groupSize > 1) chips.push(`Gruppe: ${groupSize}`);
                if (chips.length === 0) return null;
                return (
                  <div className="mb-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Aus deinem Formular
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-0.5 text-[11px] text-[var(--text-strong)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder='z.B. "Date-Abend mit Konzert und Drinks danach"'
                rows={3}
                maxLength={500}
                disabled={loading}
                className="w-full rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)] disabled:opacity-60"
              />
              <div className="mt-1 text-right text-[10px] text-[var(--text-muted)]">
                {prompt.length}/500
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Oder Beispiel wählen
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setPrompt(ex)}
                      disabled={loading}
                      className="rounded-full border border-[var(--line-subtle)] bg-white/80 px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--brand-warm)] hover:bg-[rgba(255,249,241,0.55)] hover:text-[var(--text-strong)] disabled:opacity-60"
                    >
                      ✨ {ex}
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--line-subtle)] bg-[rgba(255,249,241,0.65)] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-warm)]">
                  Vorschlag
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">{preview.summary}</p>
              </div>
              <ol className="space-y-2">
                {preview.stops.map((stop, i) => (
                  <li
                    key={`${stop.index}-${i}`}
                    className="flex items-start gap-3 rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {stop.scheduledStartAt
                          ? `${formatPlannerTime(stop.scheduledStartAt)} · ${stop.label}`
                          : stop.label}
                      </div>
                      <div className="text-sm font-medium text-[var(--text-strong)]">
                        {stop.item?.name ?? "—"}
                      </div>
                      {stop.hint ? (
                        <div className="mt-0.5 text-xs text-[var(--text-muted)]">{stop.hint}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 sm:px-6">
          {!preview ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || prompt.trim().length < 5 || !citySlug}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    Plant…
                  </>
                ) : (
                  <>
                    Plan generieren ✨
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              >
                Anderen Wunsch
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.98]"
              >
                In den Planner übernehmen →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
