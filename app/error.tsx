"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="pd24-kicker mb-4">Fehler</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
          Etwas ist schiefgelaufen
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder kehre zur Startseite zurück.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--text-soft)]">
            Fehler-ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--text-strong)] px-6 text-sm font-medium text-white transition hover:opacity-90"
          >
            Erneut versuchen
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--line-subtle)] px-6 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
