"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ChoiceReaction = {
  voter_label: string;
  created_at: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export default function SharedPlanChoicePanel({
  token,
  choiceLabel,
  initialReactions,
  expectedCount,
}: {
  token: string;
  choiceLabel: string;
  initialReactions: ChoiceReaction[];
  expectedCount?: number | null;
}) {
  const storageKey = `pd24-share-choice-voter:${token}`;
  const [voterLabel, setVoterLabel] = useState("");
  const [reactions, setReactions] = useState<ChoiceReaction[]>(initialReactions);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setVoterLabel(saved);
    } catch {}
  }, [storageKey]);

  const normalizedVoter = normalizeName(voterLabel);
  const hasConfirmed = useMemo(
    () => reactions.some((reaction) => normalizeName(reaction.voter_label) === normalizedVoter),
    [reactions, normalizedVoter]
  );

  const reactionMoment = useMemo(() => {
    const count = reactions.length;
    const total = typeof expectedCount === "number" && expectedCount > 0 ? expectedCount : null;
    const majority = total ? Math.max(2, Math.ceil(total / 2)) : null;

    if (total && count >= total) {
      return {
        label: "Alle haben bestätigt",
        note: "Die gemeinsame Wahl ist jetzt vollständig von der Gruppe bestätigt.",
        tone: "emerald",
      } as const;
    }
    if (majority && count >= majority) {
      return {
        label: "Mehrheit erreicht",
        note: "Die gemeinsame Wahl hat jetzt genug Zustimmung in der Gruppe.",
        tone: "emerald",
      } as const;
    }
    if (majority && majority - count === 1) {
      return {
        label: "Noch 1 Stimme bis zur Gruppenwahl",
        note: "Eine weitere Bestätigung würde die gemeinsame Wahl absichern.",
        tone: "amber",
      } as const;
    }
    if (count >= 2) {
      return {
        label: "Trägt schon in der Gruppe",
        note: "Die Wahl bekommt schon sichtbare Unterstützung.",
        tone: "sky",
      } as const;
    }
    if (count === 1) {
      return {
        label: "Erste Zustimmung",
        note: "Der erste Gruppenschritt ist gemacht.",
        tone: "sky",
      } as const;
    }
    return {
      label: "Noch offen",
      note: "Noch keine Zustimmung gespeichert.",
      tone: "slate",
    } as const;
  }, [reactions.length, expectedCount]);

  async function refreshReactions() {
    const { data, error } = await supabase.rpc("public_plan_choice_reactions_by_token", {
      p_token: token,
    });

    if (error) {
      console.error("Shared plan choice reactions load error:", error);
      return;
    }

    setReactions((data ?? []) as ChoiceReaction[]);
  }

  async function toggleConfirmation() {
    const trimmed = voterLabel.trim();
    if (!trimmed) {
      setStatus("Bitte gib einen Namen ein.");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      try {
        window.localStorage.setItem(storageKey, trimmed);
      } catch {}

      const { error } = await supabase.rpc("toggle_public_plan_choice_reaction", {
        p_token: token,
        p_voter_label: trimmed,
      });

      if (error) {
        console.error("Shared plan choice reaction toggle error:", error);
        setStatus("Zustimmung konnte nicht aktualisiert werden.");
        return;
      }

      await refreshReactions();
      setStatus(hasConfirmed ? "Deine Zustimmung wurde entfernt." : "Deine Zustimmung wurde gespeichert.");
    } finally {
      setSaving(false);
    }
  }

  const toneClasses =
    reactionMoment.tone === "emerald"
      ? "border-[var(--state-success)]/30 text-[var(--state-success)]"
      : reactionMoment.tone === "amber"
        ? "border-[var(--state-warning)]/30 text-[var(--state-warning)]"
        : reactionMoment.tone === "sky"
          ? "border-[var(--state-info)]/30 text-[var(--state-info)]"
          : "border-slate-300 text-slate-700";

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-950">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Zustimmung zur gemeinsamen Wahl</div>
          <div className="mt-1 text-xs text-sky-900/80">
            Sichtbar und fortschreibbar für die geteilte Wahl: {choiceLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`rounded-full border bg-white px-3 py-1 text-xs font-medium ${toneClasses}`}>
            {reactionMoment.label}
          </div>
          <div className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-medium">
            {reactions.length}
            {typeof expectedCount === "number" && expectedCount > 0 ? ` von ${expectedCount}` : ""}
            {" "}Bestätigungen
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-sky-900/80">{reactionMoment.note}</div>

      <div className="mt-3 flex gap-3 flex-wrap">
        <input
          value={voterLabel}
          onChange={(e) => setVoterLabel(e.target.value)}
          placeholder="Dein Name"
          className="min-w-[180px] flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2"
        />
        <button
          type="button"
          onClick={() => void toggleConfirmation()}
          disabled={saving}
          className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Speichere..." : hasConfirmed ? "Zustimmung entfernen" : "Ich stimme zu"}
        </button>
      </div>

      {status ? <div className="mt-2 text-xs text-sky-900/80">{status}</div> : null}

      {reactions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reactions.map((reaction) => (
            <span
              key={`${reaction.voter_label}-${reaction.created_at}`}
              className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs text-sky-900"
            >
              {reaction.voter_label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-sky-900/80">
          Noch keine Zustimmung gespeichert. Der erste Klick macht die Gruppenwahl direkt sichtbar.
        </div>
      )}
    </div>
  );
}
