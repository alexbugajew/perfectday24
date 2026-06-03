"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RoutesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Routes error:", error);
  }, [error]);

  return (
    <div className="pd24-page-wide py-16">
      <div className="mx-auto max-w-lg rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="pd24-kicker mb-4">Routenstudio</div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-2xl">
          Route konnte nicht geladen werden
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
          Ein Fehler ist aufgetreten. Bitte versuche es erneut oder kehre zur Übersicht zurück.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--text-soft)]">ID: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Erneut versuchen
          </button>
          <Link
            href="/explore"
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--line-subtle)] px-5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
          >
            Explore öffnen
          </Link>
        </div>
      </div>
    </div>
  );
}
