"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { norm } from "@/lib/planner";
import { queuePlannerInviteDraft, type PlannerInviteMemberDraft } from "@/lib/social/planner-group";

type CreatorProfileSuggestion = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type ProfileInterestRow = {
  user_id: string;
  interests?: unknown;
};

function parseInterests(row: ProfileInterestRow | null | undefined) {
  const arr = Array.isArray(row?.interests) ? row.interests : [];
  return arr.map((x) => norm(String(x))).filter(Boolean);
}

export default function InvitePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [results, setResults] = useState<CreatorProfileSuggestion[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const clean = query.trim().replace(/^@+/, "");
    if (clean.length < 2) {
      setResults([]);
      setLoading(false);
      setErrorText(null);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const { data, error } = await supabase
          .from("creator_profiles")
          .select("user_id, username, display_name, avatar_url, bio")
          .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
          .limit(12);

        if (error) {
          console.error("Invite search error:", error);
          if (active) {
            setResults([]);
            setErrorText("Profile konnten nicht geladen werden.");
          }
          return;
        }

        if (!active) return;
        setResults((data ?? []) as CreatorProfileSuggestion[]);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  async function addToPlanner(profile: CreatorProfileSuggestion) {
    setToast(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (error) {
        console.error("Invite profile load error:", error);
        setToast("Interessen konnten nicht geladen werden.");
        return;
      }

      const interests = parseInterests((data ?? null) as ProfileInterestRow | null);
      if (interests.length === 0) {
        setToast("Dieses Profil hat noch keine gespeicherten Interessen.");
        return;
      }

      const nextMember: PlannerInviteMemberDraft = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random()}`,
        name: profile.display_name || (profile.username ? `@${profile.username}` : "Teilnehmer"),
        interests: interests.slice(0, 12),
        profileUserId: profile.user_id,
        profileHandle: profile.username,
      };

      queuePlannerInviteDraft(nextMember);
      setToast("Profil wurde für den Planner vorgemerkt.");
    } catch (error) {
      console.error("Invite add error:", error);
      setToast("Profil konnte nicht übernommen werden.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="pd24-shell p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="pd24-kicker">Invite</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
              Gruppe einladen
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Suche nach Profilen und übernimm ihre gespeicherten Interessen direkt in den Planner.
            </p>
          </div>
          <Link
            href="/planner"
            className="pd24-btn pd24-btn-secondary"
          >
            Zurück zum Planner
          </Link>
        </div>

        <div className="mt-5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach @username oder Anzeigename"
            className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 text-[var(--text-strong)] placeholder:text-[var(--text-soft)]"
          />
        </div>

        {toast ? (
          <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-muted)]">
            {toast}
          </div>
        ) : null}
      </section>

      <section className="pd24-shell p-6">
        {loading ? (
          <div className="text-sm text-[var(--text-muted)]">Suche läuft...</div>
        ) : errorText ? (
          <div className="text-sm text-[var(--state-error)]">{errorText}</div>
        ) : results.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((profile) => (
              <div
                key={`${profile.user_id}-${profile.username ?? "no-username"}`}
                className="pd24-card p-4"
              >
                <div className="flex items-start gap-3">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || profile.username || "Profil"}
                      className="h-14 w-14 rounded-full border border-[var(--line-subtle)] object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-lg font-semibold text-[var(--text-muted)]">
                      {(profile.display_name || profile.username || "P").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text-strong)]">
                      {profile.display_name || profile.username || "Profil"}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {profile.username ? `@${profile.username}` : profile.user_id}
                    </div>
                    {profile.bio ? (
                      <div className="mt-2 line-clamp-3 text-sm text-[var(--text-muted)]">
                        {profile.bio}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void addToPlanner(profile)}
                    className="pd24-btn pd24-btn-sm pd24-btn-primary"
                  >
                    In den Planner übernehmen
                  </button>
                  {profile.username ? (
                    <Link
                      href={`/u/${profile.username}`}
                      className="pd24-btn pd24-btn-sm pd24-btn-secondary"
                    >
                      Profil ansehen
                    </Link>
                  ) : null}
                  <Link
                    href="/planner"
                    className="pd24-btn pd24-btn-sm pd24-btn-secondary"
                  >
                    Planner öffnen
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">
            Suche nach Profilen, um Gruppenmitglieder mit ihren Interessen zu übernehmen.
          </div>
        )}
      </section>
    </div>
  );
}
