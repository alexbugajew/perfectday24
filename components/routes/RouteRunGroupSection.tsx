"use client";

import { useEffect, useMemo, useState } from "react";
import PlanExpensesPanel from "@/components/events/PlanExpensesPanel";
import {
  readPlannerInviteDrafts,
  writePlannerInviteDrafts,
  type PlannerInviteMemberDraft,
} from "@/lib/social/planner-group";

type Props = {
  routeId: string;
  routeSlug: string | null;
  routeTitle: string;
};

function makeMemberId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `member-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const BENEFITS: Array<{ title: string; detail: string; soon?: boolean }> = [
  {
    title: "Kosten fair teilen",
    detail: "Ausgaben eintragen und sofort sehen, was jede Person übernimmt.",
  },
  {
    title: "Stops auf euch abstimmen",
    detail: "Die Route berücksichtigt die Interessen aller Gruppenmitglieder.",
  },
  {
    title: "Gruppenchat & gemeinsame Fotos",
    detail: "Absprachen und Erinnerungen an einem Ort sammeln.",
    soon: true,
  },
];

/**
 * Gruppen-Bereich am Ende der Route-Live-Seite. Solo erscheint eine
 * Einladungs-Karte mit den Gruppen-Vorteilen; erst mit mindestens einem
 * Mitglied wird das Kosten-teilen-Panel sichtbar. Die Mitglieder teilen
 * sich den Speicher mit der Planner-Gruppe (pd24_group_invites), damit
 * Personalisierung und Kostenteilung dieselbe Gruppe sehen.
 */
export default function RouteRunGroupSection({ routeId, routeSlug, routeTitle }: Props) {
  const [members, setMembers] = useState<PlannerInviteMemberDraft[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // localStorage ist erst nach der Hydration lesbar — bewusster Einmal-Sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMembers(readPlannerInviteDrafts());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/routes/${routeSlug ?? ""}`;
  }, [routeSlug]);

  const shareMessage = useMemo(
    () =>
      `Ich plane gerade "${routeTitle}" auf PerfectDay24 – komm mit! Hier ist die Route: ${shareUrl}`,
    [routeTitle, shareUrl]
  );

  function persistMembers(next: PlannerInviteMemberDraft[]) {
    setMembers(next);
    writePlannerInviteDrafts(next);
  }

  function addMember() {
    const name = nameInput.trim();
    if (!name) return;
    persistMembers([...members, { id: makeMemberId(), name, interests: [] }]);
    setNameInput("");
  }

  function removeMember(id: string) {
    persistMembers(members.filter((member) => member.id !== id));
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
    } catch {
      // Clipboard nicht verfügbar (z. B. ohne HTTPS) — kein harter Fehler.
    }
  }

  const hasGroup = members.length > 0;

  if (!hasGroup && !panelOpen) {
    return (
      <section className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--brand-warm-cloud)] p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="pd24-kicker-warm">Gemeinsam unterwegs</div>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)] sm:text-xl">
          Macht diese Route zur Gruppen-Tour
        </h2>
        <ul className="mt-3 space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-warm-soft)] text-[11px] font-semibold text-[var(--brand-warm-ink)]"
              >
                ✓
              </span>
              <div className="min-w-0 text-sm leading-6">
                <span className="font-medium text-[var(--text-strong)]">{benefit.title}</span>
                {benefit.soon ? (
                  <span className="ml-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-1.5 py-0.5 align-middle text-[10px] text-[var(--text-muted)]">
                    bald
                  </span>
                ) : null}
                <span className="text-[var(--text-muted)]"> — {benefit.detail}</span>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="pd24-btn pd24-btn-primary mt-4 w-full sm:w-auto"
        >
          Gruppe erstellen & Freunde einladen
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="pd24-kicker-warm">Eure Gruppe</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)] sm:text-xl">
              {hasGroup
                ? `${members.length + 1} Personen auf dieser Route`
                : "Wer ist mit dabei?"}
            </h2>
          </div>
          {!hasGroup ? (
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-xs text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-strong)]"
            >
              Doch alleine unterwegs
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--brand-warm)]/40 bg-[var(--brand-warm-soft)] px-3 py-1.5 text-xs font-medium text-[var(--brand-warm-ink)]">
            Ich
          </span>
          {members.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
            >
              {member.name}
              <button
                type="button"
                onClick={() => removeMember(member.id)}
                aria-label={`${member.name} entfernen`}
                className="text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addMember();
              }
            }}
            placeholder="Name, z. B. Lisa"
            className="w-full rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-warm)] focus:outline-none sm:max-w-xs"
          />
          <button
            type="button"
            onClick={addMember}
            disabled={nameInput.trim().length === 0}
            className="pd24-btn pd24-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>

        <div className="mt-4 border-t border-[var(--line-subtle)] pt-4">
          <div className="text-xs text-[var(--text-muted)]">
            Freunde einladen — sie öffnen die Route direkt über euren Link.
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
              target="_blank"
              rel="noreferrer"
              className="pd24-btn pd24-btn-secondary text-center"
            >
              Per WhatsApp einladen
            </a>
            <button type="button" onClick={copyShareLink} className="pd24-btn pd24-btn-secondary">
              {copied ? "Kopiert ✓" : "Einladungslink kopieren"}
            </button>
          </div>
        </div>
      </section>

      {hasGroup ? (
        <section>
          <PlanExpensesPanel
            targetType="route"
            targetId={routeId}
            participantCount={members.length + 1}
            participantLabels={["Ich", ...members.map((member) => member.name)]}
          />
        </section>
      ) : null}
    </div>
  );
}
