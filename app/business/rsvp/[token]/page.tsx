"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParticipantRow = {
  id: string;
  event_plan_id: string;
  participant_name: string | null;
  guest_email: string | null;
  invitation_token: string;
  rsvp_status: string;
  rsvp_at: string | null;
  event_title: string | null;
  event_date: string | null;
  city_slug: string | null;
  occasion_slug: string | null;
};

const OCCASION_LABEL: Record<string, string> = {
  teambuilding:    "Teambuilding",
  firmenfeier:     "Firmenfeier",
  konferenz:       "Konferenz",
  jubilaeum:       "Jubiläum",
  betriebsausflug: "Betriebsausflug",
  weihnachtsfeier: "Weihnachtsfeier",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RsvpPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [participant, setParticipant] = useState<ParticipantRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState<"confirmed" | "declined" | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const { data, error } = await supabase.rpc("rsvp_participant_by_token", { p_token: token });

      if (error || !data || (data as ParticipantRow[]).length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = (data as ParticipantRow[])[0];
      setParticipant(row);

      // If already answered, show confirmation immediately
      if (row.rsvp_status === "confirmed" || row.rsvp_status === "declined") {
        setDone(row.rsvp_status as "confirmed" | "declined");
      }

      setLoading(false);
    })();
  }, [token]);

  async function submitRsvp(status: "confirmed" | "declined") {
    setSubmitting(true);
    await supabase.rpc("submit_rsvp", { p_token: token, p_status: status });
    setParticipant((prev) => prev ? { ...prev, rsvp_status: status } : prev);
    setDone(status);
    setSubmitting(false);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
      </div>
    );
  }

  if (notFound || !participant) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-semibold text-[var(--text-strong)]">Einladung nicht gefunden</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Dieser Link ist abgelaufen oder wurde bereits verwendet.
        </p>
        <Link href="/" className="pd24-btn pd24-btn-primary mt-6">
          Zur Startseite
        </Link>
      </div>
    );
  }

  if (done) {
    const confirmed = done === "confirmed";
    return (
      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        <div className={`rounded-3xl p-8 text-center ${
          confirmed ? "pd24-status-success" : "pd24-status-error"
        }`}>
          <div className="text-4xl">{confirmed ? "🎉" : "😔"}</div>
          <h1 className="mt-4 text-xl font-bold text-[var(--text-strong)]">
            {confirmed ? "Wir freuen uns auf dich!" : "Schade, dass du nicht dabei sein kannst."}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {confirmed
              ? `Deine Teilnahme an „${participant.event_title ?? "dem Event"}" ist bestätigt.`
              : `Du hast für „${participant.event_title ?? "das Event"}" abgesagt.`}
          </p>

          {confirmed && (
            <div className="mt-6 rounded-2xl border border-[var(--line-subtle)] bg-white p-4 text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Event-Details</div>
              <div className="mt-3 space-y-1.5 text-sm text-[var(--text-strong)]">
                <div>📅 {formatDate(participant.event_date)}</div>
                {participant.city_slug && <div>📍 {participant.city_slug}</div>}
                {participant.occasion_slug && (
                  <div>🎯 {OCCASION_LABEL[participant.occasion_slug] ?? participant.occasion_slug}</div>
                )}
              </div>
            </div>
          )}

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
          >
            Zur Startseite →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="pd24-meta mb-2">
        Einladung
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-strong)]">
        {participant.event_title ?? "Event-Einladung"}
      </h1>
      {participant.participant_name && (
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Hallo {participant.participant_name} — bitte bestätige deine Teilnahme.
        </p>
      )}

      {/* Event details */}
      <div className="mt-6 rounded-2xl border border-[var(--line-subtle)] bg-white p-5 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Event-Details</div>
        <div className="mt-2 space-y-2 text-sm text-[var(--text-strong)]">
          {participant.event_date && <div className="flex items-center gap-2"><span>📅</span><span>{formatDate(participant.event_date)}</span></div>}
          {participant.city_slug   && <div className="flex items-center gap-2"><span>📍</span><span>{participant.city_slug}</span></div>}
          {participant.occasion_slug && (
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span>{OCCASION_LABEL[participant.occasion_slug] ?? participant.occasion_slug}</span>
            </div>
          )}
        </div>
      </div>

      {/* RSVP buttons */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          onClick={() => void submitRsvp("confirmed")}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--state-success)] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          ✓ Ich bin dabei
        </button>
        <button
          onClick={() => void submitRsvp("declined")}
          disabled={submitting}
          className="pd24-status-error flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          ✗ Ich kann nicht
        </button>
      </div>

      {submitting && (
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">Wird gespeichert…</p>
      )}
    </div>
  );
}
