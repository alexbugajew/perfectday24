"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  OCCASION_EMOJI,
  OCCASION_LABEL,
  getInviteTheme,
} from "@/lib/events/occasion-theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceProvider = {
  id: string;
  name: string;
  service_type: string;
};

type EventBooking = {
  id: string;
  need_slug: string;
  service_providers: ServiceProvider | null;
};

type SharedPlan = {
  id: string;
  title: string;
  occasion_slug: string;
  city_slug: string;
  event_date: string | null;
  guest_count: number | null;
  selected_needs: string[];
  notes: string | null;
  share_token: string;
  host_display_name: string | null;
  invite_note: string | null;
  // Erst nach der Migration 20260731120000 Teil der RPC-Antwort — optional.
  cover_image_url?: string | null;
  created_at: string;
};

type RsvpState = "idle" | "submitting" | "success_accepted" | "success_declined" | "error_duplicate" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

// Labels, Emojis und Farbwelten kommen aus lib/events/occasion-theme —
// geteilt mit den OG-Preview-Bildern (opengraph-image.tsx), damit Link-
// Vorschau und Einladungskarte identisch aussehen.

const NEED_LABEL: Record<string, string> = {
  location:   "Location",
  catering:   "Catering",
  musik:      "Musik",
  deko:       "Dekoration",
  florist:    "Florist",
  fotografie: "Fotografie",
  video:      "Videografie",
  moderation: "Moderation",
  animation:  "Animation",
  torte:      "Torte",
  technik:    "Technik",
  transport:  "Transport",
};

const SERVICE_TYPE_DESC: Record<string, string> = {
  location:      "sorgt für den perfekten Rahmen",
  catering:      "verwöhnt eure Gaumen",
  dj:            "bringt die Musik",
  band:          "spielt live für euch",
  entertainment: "sorgt für Unterhaltung",
  decoration:    "schmückt den Raum",
  florist:       "zaubert Blumenarrangements",
  photography:   "hält den Moment fest",
  video:         "filmt unvergessliche Momente",
  moderator:     "führt durch das Programm",
  animation:     "sorgt für gute Laune",
  cake:          "backt die Torte",
  technology:    "kümmert sich um die Technik",
  transport:     "bringt euch sicher hin",
};

// ─── Invitation text generator ────────────────────────────────────────────────

function buildInviteText(plan: SharedPlan, cityName: string): string {
  const host   = plan.host_display_name ?? null;
  const when   = plan.event_date
    ? new Date(plan.event_date).toLocaleDateString("de-DE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const hosted = host ? `von ${host}` : "";

  const templates: Record<string, string> = {
    geburtstag: `${when ? `Am ${when}` : "Bald"} ist es so weit — ein besonderer Anlass ${hosted} steht vor der Tür. Wir möchten diesen Geburtstag mit den Menschen feiern, die uns am Herzen liegen. Freut euch auf einen Abend voller guter Gespräche, Lachen und unvergesslicher Momente${cityName ? ` in ${cityName}` : ""}.`,

    hochzeit: `Mit großer Freude und voller Vorfreude laden wir euch ein, unseren besonderen Tag mit uns zu teilen. ${when ? `Am ${when}` : "An unserem großen Tag"} geben wir uns das Ja-Wort${cityName ? ` in ${cityName}` : ""} — und möchten dieses Glück mit unseren liebsten Menschen feiern. Wir freuen uns auf jeden, der dabei sein kann.`,

    firmenfeier: `Es ist uns eine Freude, euch ${hosted} zu unserer Firmenfeier einzuladen${cityName ? ` in ${cityName}` : ""}${when ? `, am ${when}` : ""}. Ein Abend zum Feiern, Durchatmen und gemeinsamen Zurückblicken auf das, was wir zusammen erreicht haben. Wir freuen uns auf euch.`,

    teambuilding: `Gemeinsam stark — das ist unser Motto. ${when ? `Am ${when}` : "Bald"} laden wir euch${cityName ? ` nach ${cityName}` : ""} zu einem besonderen Teamtag ein. Freut euch auf inspirierende Erlebnisse, neue Perspektiven und jede Menge Spaß abseits des Alltags.`,

    kindergeburtstag: `${when ? `Am ${when}` : "Bald"} wird gefeiert! ${hosted} hat Geburtstag und darf seine liebsten Freunde einladen. Freut euch auf einen unvergesslichen Nachmittag voller Spiel, Spaß und natürlich Torte${cityName ? ` in ${cityName}` : ""}. Wir freuen uns riesig auf euch!`,

    konferenz: `Wir laden euch herzlich ${hosted ? `${hosted} ` : ""}zu unserer Veranstaltung ein${cityName ? ` in ${cityName}` : ""}${when ? `, am ${when}` : ""}. Freut euch auf spannende Fachvorträge, wertvolle Gespräche und einen informativen Austausch. Wir freuen uns auf eure Teilnahme.`,

    jubilaeum: `${when ? `Am ${when}` : "Bald"} begehen wir ein besonderes Jubiläum ${hosted}${cityName ? ` in ${cityName}` : ""}. Dieser Meilenstein soll gebührend gefeiert werden — mit all jenen, die diesen Weg mitgegangen sind. Wir freuen uns sehr auf euer Kommen.`,

    staedtereise: `${when ? `Ab dem ${when}` : "Bald"} geht es auf Entdeckungsreise${cityName ? ` nach ${cityName}` : ""}! ${hosted ? `${hosted} lädt ein zu` : "Wir freuen uns auf"} ein unvergessliches Erlebnis gemeinsam. Kulturelle Highlights, gutes Essen und die schönsten Momente — wir erleben sie zusammen.`,
  };

  return templates[plan.occasion_slug]
    ?? `Wir laden euch herzlich zu unserem ${OCCASION_LABEL[plan.occasion_slug] ?? "Event"} ein${cityName ? ` in ${cityName}` : ""}${when ? `, am ${when}` : ""}. Wir freuen uns auf euch.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Ganztägiger Kalendereintrag als .ics-Download — rein clientseitig, damit
// Gäste den Termin mit einem Tap in Apple/Google/Outlook übernehmen können.
function downloadIcs(plan: SharedPlan, occasionLabel: string, cityName: string) {
  if (!plan.event_date) return;
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const startDate = plan.event_date.slice(0, 10);
  const start = startDate.replace(/-/g, "");
  const endD = new Date(`${startDate}T12:00:00`);
  endD.setDate(endD.getDate() + 1);
  const end = `${endD.getFullYear()}${String(endD.getMonth() + 1).padStart(2, "0")}${String(endD.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const summary = plan.title || occasionLabel;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PerfectDay24//Einladung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${plan.share_token}@perfectday24.de`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(summary)}`,
    cityName ? `LOCATION:${esc(cityName)}` : null,
    `DESCRIPTION:${esc(`Einladung: ${window.location.href}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `einladung-${start}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();

  const [plan, setPlan]         = useState<SharedPlan | null>(null);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [cityName, setCityName] = useState("");
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // RSVP form
  const [guestName, setGuestName]   = useState("");
  const [message, setMessage]       = useState("");
  const [rsvpState, setRsvpState]   = useState<RsvpState>("idle");

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setLoadError(false);

    (async () => {
      const { data: rows, error } = await supabase.rpc("public_event_plan_by_token", {
        p_token: token,
      });

      // Fetch-/Serverfehler ≠ "Link existiert nicht": bei transienten Fehlern
      // neutralen Retry-Zustand zeigen statt "abgelaufen" zu behaupten.
      if (error) {
        console.error("Einladung laden fehlgeschlagen", error);
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const planRow = (Array.isArray(rows) ? rows[0] : rows) as SharedPlan;
      setPlan(planRow);
      trackEvent(ANALYTICS_EVENTS.inviteOpened, { occasion: planRow.occasion_slug ?? null });

      // Load city name
      if (planRow.city_slug) {
        const { data: city } = await supabase
          .from("cities")
          .select("name")
          .eq("slug", planRow.city_slug)
          .single();
        if (city) setCityName(city.name);
      }

      // Load bookings — provider names only, no prices
      const { data: bkgs } = await supabase
        .from("event_bookings")
        .select("id, need_slug, service_providers ( id, name, service_type )")
        .eq("event_plan_id", planRow.id);

      setBookings((bkgs ?? []) as unknown as EventBooking[]);
      setLoading(false);
    })();
  }, [token, reloadKey]);

  async function handleRsvp(response: "accepted" | "declined") {
    if (!plan || !guestName.trim()) return;
    setRsvpState("submitting");

    const { data, error } = await supabase.rpc("submit_event_rsvp", {
      p_token:    token,
      p_name:     guestName.trim(),
      p_response: response,
      p_message:  message.trim() || null,
    });

    if (error) { setRsvpState("error"); return; }

    const result = String(data);
    if (result === "ok") {
      setRsvpState(response === "accepted" ? "success_accepted" : "success_declined");
    } else if (result === "error:duplicate") {
      setRsvpState("error_duplicate");
    } else {
      setRsvpState("error");
    }
  }

  // ─── Render: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas-warm)]">
        <div aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-warm-deep)] border-t-transparent" />
        <span className="sr-only">Einladung wird geladen …</span>
      </div>
    );
  }

  // ─── Render: load error (transient) ────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-canvas-warm)] px-4 text-center">
        <div className="text-4xl">📡</div>
        <p className="text-lg font-semibold text-[var(--text-strong)]">Gerade nicht erreichbar</p>
        <p className="text-sm text-[var(--text-soft-warm)]">
          Die Einladung konnte nicht geladen werden. Bitte versuche es gleich noch einmal.
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="pd24-btn pd24-btn-sm pd24-btn-secondary mt-2"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // ─── Render: not found ─────────────────────────────────────────────────────

  if (notFound || !plan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-canvas-warm)] px-4 text-center">
        <div className="text-4xl">🔗</div>
        <p className="text-lg font-semibold text-[var(--text-strong)]">Einladung nicht gefunden</p>
        <p className="text-sm text-[var(--text-soft-warm)]">Dieser Link ist abgelaufen oder existiert nicht.</p>
        <Link href="/" className="mt-2 text-sm text-[var(--brand-warm-deep)] underline underline-offset-2">
          Zur Startseite
        </Link>
      </div>
    );
  }

  const occasionLabel = OCCASION_LABEL[plan.occasion_slug] ?? plan.occasion_slug;
  const occasionEmoji = OCCASION_EMOJI[plan.occasion_slug] ?? "✨";
  const theme         = getInviteTheme(plan.occasion_slug);
  const inviteText    = plan.invite_note ?? buildInviteText(plan, cityName);
  const displayCity   = cityName || plan.city_slug;

  const bookedNeeds = (plan.selected_needs ?? []).filter(
    (n) => bookings.some((b) => b.need_slug === n)
  );

  // ─── RSVP success ─────────────────────────────────────────────────────────

  if (rsvpState === "success_accepted" || rsvpState === "success_declined") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg-canvas-warm)] px-4 text-center">
        <div className="text-6xl">
          {rsvpState === "success_accepted" ? "🎉" : "💌"}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-strong)]">
            {rsvpState === "success_accepted"
              ? "Wir freuen uns auf dich!"
              : "Danke für deine Rückmeldung."}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted-warm)]">
            {rsvpState === "success_accepted"
              ? `${guestName}, wir haben deine Zusage gespeichert. Bis bald!`
              : `${guestName}, schade dass du nicht dabei sein kannst. Wir haben deine Absage notiert.`}
          </p>
        </div>
        <p className="text-xs text-[var(--text-soft-warm)]">
          Organisiert mit{" "}
          <Link href="/" style={{ color: theme.accent }}>PerfectDay24</Link>
        </p>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-canvas-warm)]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 py-16 sm:py-24"
        style={{
          background: `linear-gradient(150deg, ${theme.heroFrom} 0%, ${theme.heroMid} 50%, ${theme.heroTo} 100%)`,
        }}
      >
        {/* Decorative circle */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full opacity-15"
          style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
        />

        <div className="relative mx-auto max-w-lg text-center">
          <div
            className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl"
            style={{ boxShadow: `0 8px 32px ${theme.glow}` }}
          >
            {occasionEmoji}
          </div>

          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
            Einladung · {occasionLabel}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
            {plan.title || occasionLabel}
          </h1>

          {/* Key facts strip */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {plan.event_date && (
              <FactChip icon="📅" label={formatDate(plan.event_date)} borderColor={theme.soft} />
            )}
            {displayCity && (
              <FactChip icon="📍" label={displayCity} borderColor={theme.soft} />
            )}
            {plan.host_display_name && (
              <FactChip icon="👤" label={`Eingeladen von ${plan.host_display_name}`} borderColor={theme.soft} />
            )}
            {plan.guest_count && (
              <FactChip icon="👥" label={`${plan.guest_count} Gäste erwartet`} borderColor={theme.soft} />
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">

        {/* Cover image — vom Gastgeber hochgeladen, gerahmt wie ein Foto in
            einer Einladungskarte. -mt zieht es leicht in den Hero hinein. */}
        {plan.cover_image_url && (
          <div className="-mt-16 mb-10">
            <div
              className="overflow-hidden rounded-[var(--radius-card)] border-4 border-white bg-white shadow-[0_18px_44px_rgba(15,23,42,0.14)]"
              style={{ outline: `1px solid ${theme.soft}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Host-Upload aus Supabase-Storage, Host unbekannt für next/image-remotePatterns */}
              <img
                src={plan.cover_image_url}
                alt={plan.title || occasionLabel}
                className="aspect-[3/2] w-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Invitation text */}
        <div className="mb-10 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm" style={{ borderColor: theme.soft }}>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: theme.soft }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
              Einladung
            </span>
            <div className="h-px flex-1" style={{ background: theme.soft }} />
          </div>
          <p className="leading-7 text-[var(--text-muted-warm)]" style={{ fontFamily: "Georgia, serif", fontSize: "15px" }}>
            {inviteText}
          </p>
          {plan.notes && (
            <p className="mt-4 border-t border-[rgba(23,23,23,0.06)] pt-4 text-sm leading-6 text-[var(--text-muted-warm)]">
              {plan.notes}
            </p>
          )}

          {plan.event_date && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => downloadIcs(plan, occasionLabel, cityName)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-white px-4 text-xs font-semibold transition hover:bg-[var(--bg-surface)]"
                style={{ borderColor: theme.soft, color: theme.accent }}
              >
                📅 Termin in den Kalender
              </button>
            </div>
          )}
        </div>

        {/* What to expect */}
        {bookedNeeds.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-soft-warm)]">
              Was euch erwartet
            </h2>
            <div className="space-y-2">
              {bookedNeeds.map((need) => {
                const booking  = bookings.find((b) => b.need_slug === need);
                const provider = booking?.service_providers;
                const desc     = SERVICE_TYPE_DESC[provider?.service_type ?? ""] ?? "ist für euch da";
                return (
                  <div
                    key={need}
                    className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[rgba(23,23,23,0.07)] bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-canvas-warm)] text-sm">
                      {needEmoji(need)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">
                        {NEED_LABEL[need] ?? need}
                      </p>
                      {provider ? (
                        <p className="text-sm font-medium text-[var(--text-strong)]">
                          {provider.name}{" "}
                          <span className="font-normal text-[var(--text-soft-warm)]">— {desc}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-[var(--text-soft-warm)]">In Planung</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RSVP ─────────────────────────────────────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-px flex-1 bg-[rgba(23,23,23,0.06)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-strong)]">
              Rückmeldung
            </span>
            <div className="h-px flex-1 bg-[rgba(23,23,23,0.06)]" />
          </div>

          {rsvpState === "error_duplicate" && (
            <div role="alert" className="pd24-status-warning mb-4 rounded-[12px] px-4 py-3 text-sm">
              Für diesen Namen liegt bereits eine Rückmeldung vor.
            </div>
          )}
          {rsvpState === "error" && (
            <div role="alert" className="pd24-status-error mb-4 rounded-[12px] px-4 py-3 text-sm">
              Etwas ist schiefgelaufen. Bitte versuche es erneut.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="rsvp-name" className="mb-1.5 block text-sm font-medium text-[var(--text-strong)]">
                Dein Name <span style={{ color: theme.accent }}>*</span>
              </label>
              <input
                id="rsvp-name"
                type="text"
                required
                aria-required="true"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Vorname Nachname"
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg-surface-warm)] px-4 py-3 text-sm text-[var(--text-strong)] placeholder-[var(--text-soft-warm)] outline-none focus:border-[var(--text-strong)]"
              />
            </div>

            <div>
              <label htmlFor="rsvp-message" className="mb-1.5 block text-sm font-medium text-[var(--text-strong)]">
                Nachricht (optional)
              </label>
              <textarea
                id="rsvp-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Ich freue mich sehr! / Leider verhindert, weil …"
                className="w-full resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--bg-surface-warm)] px-4 py-3 text-sm text-[var(--text-strong)] placeholder-[var(--text-soft-warm)] outline-none focus:border-[var(--text-strong)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={!guestName.trim() || rsvpState === "submitting"}
                onClick={() => void handleRsvp("accepted")}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-[var(--state-success)] bg-[rgba(79,107,91,0.08)] py-3.5 text-sm font-semibold text-[var(--state-success)] transition hover:bg-[rgba(79,107,91,0.14)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xl">🎉</span>
                <span>Ich bin dabei!</span>
              </button>

              <button
                type="button"
                disabled={!guestName.trim() || rsvpState === "submitting"}
                onClick={() => void handleRsvp("declined")}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-[var(--line-strong)] bg-[var(--bg-surface-warm)] py-3.5 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[rgba(23,23,23,0.25)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xl">😔</span>
                <span>Leider nicht</span>
              </button>
            </div>

            {rsvpState === "submitting" && (
              <p role="status" className="text-center text-xs text-[var(--text-soft-warm)]">Wird gespeichert …</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-[var(--text-soft-warm)]">
            Organisiert mit{" "}
            <Link href="/" className="inline-flex min-h-10 items-center hover:underline" style={{ color: theme.accent }}>
              PerfectDay24
            </Link>
          </p>
          <Link
            href="/feiern"
            className="inline-flex min-h-10 items-center gap-1 text-xs text-[var(--text-soft-warm)] hover:text-[var(--text-strong)]"
          >
            Eigenen Event planen →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FactChip({ icon, label, borderColor }: { icon: string; label: string; borderColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium text-[var(--text-muted-warm)] shadow-sm"
      style={{ borderColor }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function needEmoji(slug: string): string {
  const map: Record<string, string> = {
    location:   "🏛️",
    catering:   "🍽️",
    musik:      "🎵",
    deko:       "💐",
    florist:    "🌸",
    fotografie: "📷",
    video:      "🎬",
    moderation: "🎤",
    animation:  "🎪",
    torte:      "🎂",
    technik:    "🔊",
    transport:  "🚐",
  };
  return map[slug] ?? "✨";
}
