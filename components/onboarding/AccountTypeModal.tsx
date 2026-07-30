"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export type AccountType = "consumer" | "creator" | "partner";

type Props = {
  userId: string;
  onDone?: () => void;
};

type CardOption = {
  type: AccountType;
  emoji: string;
  title: string;
  subtitle: string;
  bullets: string[];
};

const OPTIONS: CardOption[] = [
  {
    type: "consumer",
    emoji: "🎉",
    title: "Privatperson",
    subtitle: "Ich plane Events für mich und Freunde.",
    bullets: ["Eventplaner & Routen erstellen", "Angebote entdecken", "Kosten & Wünsche festhalten"],
  },
  {
    type: "creator",
    emoji: "✨",
    title: "Creator / Influencer",
    subtitle: "Ich erstelle Inhalte und teile Erlebnisse.",
    bullets: ["Creator-Profil mit Username", "Routen öffentlich teilen", "Community aufbauen"],
  },
  {
    type: "partner",
    emoji: "🏢",
    title: "Dienstleister / Partner",
    subtitle: "Ich biete Leistungen für Events an.",
    bullets: ["Profil im Event Planner", "Buchungsanfragen erhalten", "Angebote & Pakete pflegen"],
  },
];

export function AccountTypeModal({ userId, onDone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<AccountType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function select(type: AccountType) {
    setBusy(type);
    setError(null);

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        account_type: type,
        onboarding_type_selected: true,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      setError(upsertError.message);
      setBusy(null);
      return;
    }

    if (type === "partner") {
      router.push("/partner/onboarding");
      return;
    }

    setBusy(null);
    onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">
            Willkommen bei PerfectDay24!
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Wie möchtest du die Plattform nutzen? Du kannst das später jederzeit ändern.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              disabled={busy !== null}
              onClick={() => select(opt.type)}
              className="group flex flex-col gap-3 rounded-2xl border-2 border-[var(--line-subtle)] bg-[var(--bg-panel)] p-5 text-left transition hover:border-[var(--text-strong)] hover:shadow-md disabled:opacity-60"
            >
              <span className="text-3xl">{opt.emoji}</span>
              <div>
                <div className="font-semibold text-[var(--text-strong)]">{opt.title}</div>
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">{opt.subtitle}</div>
              </div>
              <ul className="space-y-1">
                {opt.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="mt-0.5 text-[var(--brand-accent)]">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {busy === opt.type ? (
                  <span className="text-xs text-[var(--text-muted)]">Wird gespeichert…</span>
                ) : (
                  <span className="text-xs font-medium text-[var(--brand-accent)] opacity-0 transition group-hover:opacity-100">
                    Auswählen →
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-[var(--state-error)]">{error}</p>
        )}
      </div>
    </div>
  );
}
