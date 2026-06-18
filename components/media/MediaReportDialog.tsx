"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MediaReportReason = "copyright" | "irrelevant" | "offensive" | "duplicate" | "privacy" | "other";

type MediaReportDialogProps = {
  assetId: string | null;
  assetLabel: string;
  open: boolean;
  onClose: () => void;
};

const REPORT_REASONS: Array<{ value: MediaReportReason; label: string }> = [
  { value: "copyright", label: "Copyright / Rechte" },
  { value: "privacy", label: "Privatsphaere" },
  { value: "offensive", label: "Anstoessig" },
  { value: "irrelevant", label: "Unpassend" },
  { value: "duplicate", label: "Duplikat" },
  { value: "other", label: "Sonstiges" },
];

export default function MediaReportDialog({
  assetId,
  assetLabel,
  open,
  onClose,
}: MediaReportDialogProps) {
  const [reason, setReason] = useState<MediaReportReason>("copyright");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    setNeedsLogin(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!assetId) {
      setError("Dieses Bild kann gerade nicht gemeldet werden.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setNeedsLogin(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setNeedsLogin(true);
        throw new Error("Bitte melde dich an, um ein Bild zu melden.");
      }

      const response = await fetch("/api/media/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          reason,
          note: note.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        autoHeld?: boolean;
        reviewStatus?: "open" | "reviewing";
        message?: string;
      } | null;

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsLogin(true);
        }

        throw new Error(payload?.error || "Die Meldung konnte nicht gespeichert werden.");
      }

      setSuccess(
        payload?.autoHeld
          ? payload.message || "Die Meldung wurde priorisiert. Das Bild ist bis zur Pruefung vorlaeufig ausgeblendet."
          : payload?.reviewStatus === "reviewing"
            ? "Die Meldung wurde priorisiert und direkt zur Pruefung weitergegeben."
            : "Die Meldung wurde eingereicht und intern zur Pruefung weitergegeben."
      );
      setNote("");
      setReason("copyright");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Die Meldung konnte nicht gespeichert werden.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,0.72)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[28px] border border-[rgba(255,255,255,0.18)] bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Bild melden
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{assetLabel}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Melde Copyright-, Missbrauchs- oder Qualitaetsprobleme direkt an das interne Review-Team.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-xl leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
            aria-label="Meldedialog schliessen"
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Grund
            </span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as MediaReportReason)}
              className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
            >
              {REPORT_REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Notiz
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Beschreibe kurz, was mit diesem Bild nicht stimmt."
              rows={4}
              className="w-full resize-none rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
        {needsLogin ? (
          <div className="mt-4 text-sm text-[var(--text-muted)]">
            <Link href="/profile" className="font-medium text-[var(--text-strong)] underline underline-offset-2">
              Zum Login
            </Link>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Wird gesendet..." : "Meldung absenden"}
          </button>
        </div>
      </div>
    </div>
  );
}
