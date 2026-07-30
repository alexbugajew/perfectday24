"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerProfile = {
  id: string;
  display_name: string;
  partner_type_slug: string;
};

type EventPlan = {
  id: string;
  title: string | null;
  occasion_slug: string;
  city_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  share_token: string | null;
  created_at: string;
};

type BusinessMember = {
  id: string;
  partner_profile_id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  status: string;
};

type BusinessParticipant = {
  id: string;
  event_plan_id: string;
  member_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  invitation_token: string;
  rsvp_status: string;
  business_members: { name: string; email: string | null } | null;
};

type AddMemberForm = { name: string; email: string; department: string };
type AddParticipantForm = { mode: "member" | "guest"; memberId: string; name: string; email: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_OCCASIONS = ["teambuilding", "firmenfeier", "konferenz", "jubilaeum", "betriebsausflug", "weihnachtsfeier"];

const OCCASION_LABEL: Record<string, string> = {
  teambuilding: "Teambuilding",
  firmenfeier:  "Firmenfeier",
  konferenz:    "Konferenz",
  jubilaeum:    "Jubiläum",
  betriebsausflug: "Betriebsausflug",
  weihnachtsfeier: "Weihnachtsfeier",
};

const RSVP_BADGE: Record<string, string> = {
  pending:   "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--line-subtle)]",
  confirmed: "pd24-status-success",
  declined:  "pd24-status-error",
};

const RSVP_LABEL: Record<string, string> = {
  pending:   "Ausstehend",
  confirmed: "Zugesagt",
  declined:  "Abgesagt",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function rsvpBase(origin: string, token: string): string {
  return `${origin}/business/rsvp/${token}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessDashboardPage() {
  const [loading, setLoading]                   = useState(true);
  const [userId, setUserId]                     = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile]     = useState<PartnerProfile | null>(null);
  const [events, setEvents]                     = useState<EventPlan[]>([]);
  const [cityMap, setCityMap]                   = useState<Record<string, string>>({});
  const [members, setMembers]                   = useState<BusinessMember[]>([]);
  const [participants, setParticipants]         = useState<Record<string, BusinessParticipant[]>>({});
  const [participantsLoading, setParticipantsLoading] = useState<Record<string, boolean>>({});
  const [activeEventId, setActiveEventId]       = useState<string | null>(null);
  const [activeTab, setActiveTab]               = useState<"events" | "team">("events");
  const [addMemberForm, setAddMemberForm]       = useState<AddMemberForm>({ name: "", email: "", department: "" });
  const [addMemberBusy, setAddMemberBusy]       = useState(false);
  const [addMemberError, setAddMemberError]     = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [addParticipantForms, setAddParticipantForms] = useState<Record<string, AddParticipantForm>>({});
  const [addParticipantBusy, setAddParticipantBusy]   = useState<Record<string, boolean>>({});
  const [copiedToken, setCopiedToken]           = useState<string | null>(null);

  // ── Auto-open event panel from URL param ──────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    if (eventId) {
      setActiveEventId(eventId);
    }
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }

      // Partner profile (corporate)
      const { data: membershipRows } = await supabase
        .from("partner_memberships")
        .select("partner_profile_id, partner_profiles(id, display_name, partner_type_slug)")
        .eq("user_id", uid)
        .eq("status", "active");

      const rows = (membershipRows ?? []) as Array<{
        partner_profile_id: string;
        partner_profiles: PartnerProfile | PartnerProfile[] | null;
      }>;

      const corporateRow = rows.find((r) => {
        const pp = Array.isArray(r.partner_profiles) ? r.partner_profiles[0] : r.partner_profiles;
        return pp?.partner_type_slug === "corporate";
      });

      const pp = corporateRow
        ? (Array.isArray(corporateRow.partner_profiles)
            ? corporateRow.partner_profiles[0]
            : corporateRow.partner_profiles)
        : null;

      setPartnerProfile(pp ?? null);

      if (!pp) { setLoading(false); return; }

      // Events
      const { data: eventRows } = await supabase
        .from("event_plans")
        .select("id, title, occasion_slug, city_slug, event_date, guest_count, status, share_token, created_at")
        .eq("user_id", uid)
        .in("occasion_slug", BUSINESS_OCCASIONS)
        .order("event_date", { ascending: true });

      setEvents((eventRows ?? []) as EventPlan[]);

      // Members
      const { data: memberRows } = await supabase
        .from("business_members")
        .select("id, partner_profile_id, name, email, role, department, status")
        .eq("partner_profile_id", pp.id)
        .eq("status", "active")
        .order("name");

      setMembers((memberRows ?? []) as BusinessMember[]);

      // City name lookup
      const { data: citiesData } = await supabase
        .from("cities")
        .select("slug, name");
      if (citiesData) {
        setCityMap(Object.fromEntries(
          (citiesData as { slug: string; name: string }[]).map((c) => [c.slug, c.name])
        ));
      }

      setLoading(false);
    })();
  }, []);

  // ── Load participants for one event ────────────────────────────────────────

  async function loadParticipants(eventId: string) {
    if (participants[eventId]) return; // already loaded
    setParticipantsLoading((prev) => ({ ...prev, [eventId]: true }));

    const { data } = await supabase
      .from("business_event_participants")
      .select("id, event_plan_id, member_id, guest_name, guest_email, invitation_token, rsvp_status, business_members(name, email)")
      .eq("event_plan_id", eventId)
      .order("created_at");

    setParticipants((prev) => ({ ...prev, [eventId]: (data ?? []) as unknown as BusinessParticipant[] }));
    setParticipantsLoading((prev) => ({ ...prev, [eventId]: false }));
  }

  function toggleEventPanel(eventId: string) {
    if (activeEventId === eventId) {
      setActiveEventId(null);
    } else {
      setActiveEventId(eventId);
      void loadParticipants(eventId);
    }
  }

  // ── Copy helpers ──────────────────────────────────────────────────────────

  function copyRsvpLink(token: string) {
    navigator.clipboard.writeText(rsvpBase(window.location.origin, token)).catch(() => {});
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function getOrCreateAgendaLink(event: EventPlan): Promise<string> {
    if (event.share_token) {
      return `${window.location.origin}/events/agenda/${event.share_token}`;
    }
    const newToken = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    await supabase.from("event_plans").update({ share_token: newToken }).eq("id", event.id);
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, share_token: newToken } : e));
    return `${window.location.origin}/events/agenda/${newToken}`;
  }

  async function copyAgendaLink(event: EventPlan) {
    const url = await getOrCreateAgendaLink(event);
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedToken(`agenda-${event.id}`);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  // ── Add / remove team member ──────────────────────────────────────────────

  async function addMember() {
    if (!partnerProfile || !addMemberForm.name.trim()) return;
    setAddMemberBusy(true);
    setAddMemberError(null);

    const { data, error } = await supabase
      .from("business_members")
      .insert({
        partner_profile_id: partnerProfile.id,
        name:               addMemberForm.name.trim(),
        email:              addMemberForm.email.trim() || null,
        department:         addMemberForm.department.trim() || null,
        role:               "member",
      })
      .select("id, partner_profile_id, name, email, role, department, status")
      .single();

    if (error) { setAddMemberError(error.message); setAddMemberBusy(false); return; }
    setMembers((prev) => [...prev, data as BusinessMember].sort((a, b) => a.name.localeCompare(b.name, "de")));
    setAddMemberForm({ name: "", email: "", department: "" });
    setAddMemberBusy(false);
  }

  async function removeMember(id: string) {
    setDeletingMemberId(id);
    await supabase.from("business_members").update({ status: "inactive" }).eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setDeletingMemberId(null);
  }

  // ── Add participant ───────────────────────────────────────────────────────

  function setParticipantForm(eventId: string, patch: Partial<AddParticipantForm>) {
    setAddParticipantForms((prev) => {
      const defaults: AddParticipantForm = { mode: "member", memberId: "", name: "", email: "" };
      return { ...prev, [eventId]: { ...defaults, ...(prev[eventId] ?? {}), ...patch } };
    });
  }

  async function addParticipant(eventId: string) {
    const form = addParticipantForms[eventId];
    if (!form) return;

    const isMember = form.mode === "member";
    if (isMember && !form.memberId) return;
    if (!isMember && !form.name.trim()) return;

    setAddParticipantBusy((prev) => ({ ...prev, [eventId]: true }));

    const payload: Record<string, unknown> = isMember
      ? { event_plan_id: eventId, member_id: form.memberId }
      : { event_plan_id: eventId, guest_name: form.name.trim(), guest_email: form.email.trim() || null };

    const { data, error } = await supabase
      .from("business_event_participants")
      .insert(payload)
      .select("id, event_plan_id, member_id, guest_name, guest_email, invitation_token, rsvp_status, business_members(name, email)")
      .single();

    if (!error && data) {
      setParticipants((prev) => ({
        ...prev,
        [eventId]: [...(prev[eventId] ?? []), data as unknown as BusinessParticipant],
      }));
      setAddParticipantForms((prev) => ({ ...prev, [eventId]: { mode: "member", memberId: "", name: "", email: "" } }));
    }
    setAddParticipantBusy((prev) => ({ ...prev, [eventId]: false }));
  }

  // ── KPI counts ────────────────────────────────────────────────────────────

  const allParticipants = Object.values(participants).flat();
  const upcomingEvents  = events.filter((e) => e.status === "planning" || e.status === "confirmed");
  const pendingCount    = allParticipants.filter((p) => p.rsvp_status === "pending").length;
  const confirmedCount  = allParticipants.filter((p) => p.rsvp_status === "confirmed").length;

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
        ))}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="font-medium text-[var(--text-strong)]">Bitte zuerst anmelden.</p>
        <Link href="/profile" className="pd24-btn pd24-btn-primary mt-4">
          Anmelden →
        </Link>
      </div>
    );
  }

  if (!partnerProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-medium text-[var(--text-strong)]">Noch kein Business-Profil</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Richte ein Corporate-Profil ein um das Dashboard zu nutzen.</p>
        <Link
          href="/partner/onboarding?type=corporate"
          className="pd24-btn pd24-btn-primary mt-6"
        >
          Business-Profil anlegen →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="pd24-meta">Business-Dashboard</div>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-strong)]">{partnerProfile.display_name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.setItem("pd24_event_return", "/business/dashboard");
              }
              window.location.href = "/events";
            }}
            className="pd24-btn pd24-btn-primary"
          >
            + Neues Event planen
          </button>
          <Link
            href="/profile"
            className="pd24-btn pd24-btn-secondary"
          >
            ← Profil
          </Link>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Kommende Events",       value: upcomingEvents.length },
          { label: "Team-Mitglieder",        value: members.length },
          { label: "Offene Einladungen",     value: pendingCount },
          { label: "Bestätigte Teilnahmen",  value: confirmedCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4">
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="mt-1 text-2xl font-bold text-[var(--text-strong)]">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white p-1.5">
        {(["events", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-[var(--text-strong)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {tab === "events" ? "Events" : `Team (${members.length})`}
          </button>
        ))}
      </div>

      {/* ── Events tab ──────────────────────────────────────────────────────── */}
      {activeTab === "events" && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">Noch keine Business-Events angelegt.</p>
              <Link href="/events" className="pd24-btn pd24-btn-primary pd24-btn-sm mt-3">
                Erstes Event planen →
              </Link>
            </div>
          ) : (
            events.map((event) => {
              const pts = participants[event.id] ?? [];
              const pPending   = pts.filter((p) => p.rsvp_status === "pending").length;
              const pConfirmed = pts.filter((p) => p.rsvp_status === "confirmed").length;
              const pDeclined  = pts.filter((p) => p.rsvp_status === "declined").length;
              const isOpen     = activeEventId === event.id;
              const pLoading   = participantsLoading[event.id] ?? false;
              const pForm      = addParticipantForms[event.id] ?? { mode: "member" as const, memberId: "", name: "", email: "" };

              return (
                <div key={event.id} className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white">
                  {/* Event card header */}
                  <div className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--bg-panel)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            {OCCASION_LABEL[event.occasion_slug] ?? event.occasion_slug}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            event.status === "confirmed" ? "pd24-status-success" : "pd24-status-warning"
                          }`}>
                            {event.status === "confirmed" ? "Bestätigt" : event.status === "planning" ? "In Planung" : event.status}
                          </span>
                        </div>
                        <h3 className="mt-1.5 font-semibold text-[var(--text-strong)]">
                          {event.title?.trim()
                            ? event.title
                            : `${OCCASION_LABEL[event.occasion_slug] ?? event.occasion_slug}${event.event_date ? " · " + formatDate(event.event_date) : ""}`}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                          {event.event_date && <span>📅 {formatDate(event.event_date)}</span>}
                          {event.city_slug  && <span>📍 {cityMap[event.city_slug] ?? event.city_slug}</span>}
                          {event.guest_count && <span>👥 {event.guest_count} Gäste</span>}
                        </div>
                        {/* RSVP summary (only after participants loaded) */}
                        {pts.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            <span className="pd24-status-success rounded-full px-2 py-0.5 text-[11px]">{pConfirmed} Zugesagt</span>
                            <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">{pPending} Ausstehend</span>
                            {pDeclined > 0 && <span className="pd24-status-error rounded-full px-2 py-0.5 text-[11px]">{pDeclined} Abgesagt</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          onClick={() => toggleEventPanel(event.id)}
                          className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--line-strong)]"
                        >
                          {isOpen ? "Schließen" : "Teilnehmer verwalten"}
                        </button>
                        <button
                          onClick={() => void copyAgendaLink(event)}
                          className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--line-strong)]"
                        >
                          {copiedToken === `agenda-${event.id}` ? "✓ Kopiert!" : "Agenda teilen"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Participant panel */}
                  {isOpen && (
                    <div className="border-t border-[var(--line-subtle)] bg-[var(--bg-panel)] px-5 py-4 space-y-4">
                      {pLoading ? (
                        <p className="text-xs text-[var(--text-muted)]">Lädt…</p>
                      ) : pts.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">Noch keine Teilnehmer hinzugefügt.</p>
                      ) : (
                        <div className="space-y-2">
                          {pts.map((p) => {
                            const name = p.business_members?.name ?? p.guest_name ?? "—";
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-[var(--text-strong)] truncate">{name}</div>
                                  <div className="text-xs text-[var(--text-muted)] truncate">
                                    {p.business_members?.email ?? p.guest_email ?? ""}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${RSVP_BADGE[p.rsvp_status] ?? RSVP_BADGE.pending}`}>
                                    {RSVP_LABEL[p.rsvp_status] ?? p.rsvp_status}
                                  </span>
                                  <button
                                    onClick={() => copyRsvpLink(p.invitation_token)}
                                    className="rounded-lg border border-[var(--line-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                                  >
                                    {copiedToken === p.invitation_token ? "✓" : "Link"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add participant form */}
                      <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-4 space-y-3">
                        <div className="flex gap-2">
                          {(["member", "guest"] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setParticipantForm(event.id, { mode })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                pForm.mode === mode
                                  ? "bg-[var(--text-strong)] text-white"
                                  : "border border-[var(--line-subtle)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                              }`}
                            >
                              {mode === "member" ? "Aus Team" : "Gast"}
                            </button>
                          ))}
                        </div>

                        {pForm.mode === "member" ? (
                          <select
                            value={pForm.memberId}
                            onChange={(e) => setParticipantForm(event.id, { memberId: e.target.value })}
                            className="w-full rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-strong)]"
                          >
                            <option value="">Mitglied auswählen…</option>
                            {members
                              .filter((m) => !pts.some((p) => p.member_id === m.id))
                              .map((m) => (
                                <option key={m.id} value={m.id}>{m.name}{m.department ? ` · ${m.department}` : ""}</option>
                              ))}
                          </select>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              placeholder="Name *"
                              value={pForm.name}
                              onChange={(e) => setParticipantForm(event.id, { name: e.target.value })}
                              className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm"
                            />
                            <input
                              type="email"
                              placeholder="E-Mail"
                              value={pForm.email}
                              onChange={(e) => setParticipantForm(event.id, { email: e.target.value })}
                              className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => void addParticipant(event.id)}
                          disabled={addParticipantBusy[event.id]}
                          className="pd24-btn pd24-btn-primary pd24-btn-sm"
                        >
                          {addParticipantBusy[event.id] ? "Wird hinzugefügt…" : "+ Hinzufügen"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Team tab ────────────────────────────────────────────────────────── */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {/* Member table */}
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
              Noch keine Mitglieder im Team.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line-subtle)] bg-[var(--bg-panel)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Name</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] sm:table-cell">E-Mail</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] md:table-cell">Abteilung</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Rolle</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {members.map((m) => (
                    <tr key={m.id} className="transition hover:bg-[var(--bg-panel)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{m.name}</td>
                      <td className="hidden px-4 py-3 text-[var(--text-muted)] sm:table-cell">{m.email ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-[var(--text-muted)] md:table-cell">{m.department ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                          {m.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void removeMember(m.id)}
                          disabled={deletingMemberId === m.id}
                          className="rounded-lg border border-[var(--line-subtle)] px-2.5 py-1 text-xs text-[var(--state-error)] transition hover:border-[var(--line-strong)] disabled:opacity-50"
                        >
                          {deletingMemberId === m.id ? "…" : "Entfernen"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add member form */}
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Mitglied hinzufügen</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                placeholder="Name *"
                value={addMemberForm.name}
                onChange={(e) => setAddMemberForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={addMemberForm.email}
                onChange={(e) => setAddMemberForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm"
              />
              <input
                placeholder="Abteilung"
                value={addMemberForm.department}
                onChange={(e) => setAddMemberForm((f) => ({ ...f, department: e.target.value }))}
                className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm"
              />
            </div>
            {addMemberError && <p className="text-xs text-[var(--state-error)]">{addMemberError}</p>}
            <button
              onClick={() => void addMember()}
              disabled={addMemberBusy || !addMemberForm.name.trim()}
              className="pd24-btn pd24-btn-primary"
            >
              {addMemberBusy ? "Wird gespeichert…" : "+ Mitglied hinzufügen"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
