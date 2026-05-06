"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EditSuggestion = {
  id: string;
  author_label: string;
  message: string;
  created_at: string;
  resolved_at?: string | null;
};

export default function SharedPlanEditPanel({
  token,
  initialSuggestions,
}: {
  token: string;
  initialSuggestions: EditSuggestion[];
}) {
  const storageKey = `pd24-share-edit-author:${token}`;
  const [authorLabel, setAuthorLabel] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>(initialSuggestions);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSuggestions(initialSuggestions);
  }, [initialSuggestions]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setAuthorLabel(saved);
    } catch {}
  }, [storageKey]);

  async function refreshSuggestions() {
    const { data, error } = await supabase.rpc("public_plan_edit_suggestions_by_token", {
      p_token: token,
    });

    if (error) {
      console.error("Shared plan edit suggestions load error:", error);
      return;
    }

    setSuggestions((data ?? []) as EditSuggestion[]);
  }

  async function submitSuggestion() {
    const trimmedAuthor = authorLabel.trim();
    const trimmedMessage = message.trim();

    if (!trimmedAuthor || !trimmedMessage) {
      setStatus("Bitte Name und Aenderungswunsch ausfuellen.");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      try {
        window.localStorage.setItem(storageKey, trimmedAuthor);
      } catch {}

      const { error } = await supabase.rpc("create_public_plan_edit_suggestion", {
        p_token: token,
        p_author_label: trimmedAuthor,
        p_message: trimmedMessage,
      });

      if (error) {
        console.error("Create public plan edit suggestion error:", error);
        setStatus("Aenderungswunsch konnte nicht gespeichert werden.");
        return;
      }

      setMessage("");
      await refreshSuggestions();
      setStatus("Aenderungswunsch geteilt.");
    } finally {
      setSaving(false);
    }
  }

  const openSuggestions = suggestions.filter((entry) => !entry.resolved_at);
  const resolvedSuggestions = suggestions.filter((entry) => entry.resolved_at);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Gemeinsam weiterbearbeiten</div>
          <div className="mt-1 text-xs text-amber-900/80">
            Teile Aenderungswuensche direkt am Plan. Sie tauchen danach im Planner und im Gruppenchat auf.
          </div>
        </div>
        <div className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900">
          {openSuggestions.length} offen
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[180px,1fr,auto]">
        <input
          value={authorLabel}
          onChange={(e) => setAuthorLabel(e.target.value)}
          placeholder="Dein Name"
          className="rounded-lg border border-amber-200 bg-white px-3 py-2"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Zum Beispiel: Lieber frueher starten oder Dinner tauschen"
          className="rounded-lg border border-amber-200 bg-white px-3 py-2"
        />
        <button
          type="button"
          onClick={() => void submitSuggestion()}
          disabled={saving}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Speichere..." : "Aenderung vorschlagen"}
        </button>
      </div>

      {status ? <div className="mt-2 text-xs text-amber-900/80">{status}</div> : null}

      {openSuggestions.length ? (
        <div className="mt-4 space-y-2">
          {openSuggestions.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-amber-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{entry.author_label}</div>
                <div className="text-[11px] text-amber-800/70">
                  {new Date(entry.created_at).toLocaleString("de-DE")}
                </div>
              </div>
              <div className="mt-1 text-sm text-amber-950">{entry.message}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-xs text-amber-900/80">
          Noch keine offenen Aenderungswuensche. Der erste Vorschlag landet direkt im gemeinsamen Verlauf.
        </div>
      )}

      {resolvedSuggestions.length ? (
        <details className="mt-4 rounded-lg border border-amber-200 bg-white px-3 py-3">
          <summary className="cursor-pointer text-xs font-medium text-amber-900/80">
            Bereits aufgenommen ({resolvedSuggestions.length})
          </summary>
          <div className="mt-3 space-y-2">
            {resolvedSuggestions.slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="font-medium text-emerald-950">{entry.author_label}</div>
                <div className="mt-1 text-sm text-emerald-950">{entry.message}</div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
