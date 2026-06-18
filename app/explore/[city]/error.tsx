"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CityExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CityExplorePage]", error);
  }, [error]);

  return (
    <div className="pd24-page-standard flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl">🗺️</div>
      <h2 className="mt-4 text-xl font-semibold text-[var(--text-strong)]">
        Seite konnte nicht geladen werden
      </h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Beim Laden der Stadt-Seite ist ein Fehler aufgetreten.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex rounded-full bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Erneut versuchen
        </button>
        <Link
          href="/explore"
          className="inline-flex rounded-full border border-[var(--line-subtle)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
        >
          Alle Städte
        </Link>
      </div>
    </div>
  );
}
