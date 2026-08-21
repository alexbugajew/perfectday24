import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import { eventJsonLd, SITE_URL } from "@/lib/seo/json-ld";
import { loadEventDetail, type AroundEventSuggestion } from "@/lib/events/around-event";
import { categoryAccent } from "@/lib/events/categories";
import { plannerEventLabel } from "@/lib/planner";
import type { PlannerEventCategory } from "@/lib/planner/types";

/**
 * Detailseite einer Veranstaltung — und der eigentliche Grund, warum es die
 * Event-Strecke gibt.
 *
 * Eine reine Liste stünde gegen Eventim, Rausgegangen und die Stadtportale und
 * wäre schlechter als die Quellen, aus denen sie sich speist. Der Unterschied
 * entsteht hier: Das Event ist der Hauptmoment, davor und danach hängen an
 * derselben Zeitachse, und ein Klick übergibt alles an den Planner.
 *
 * Bewusst `noindex`: Veranstaltungen verfallen. Indexiert werden die
 * beständigen Flächen (Stadt, Kategorie); diese Seite trägt trotzdem
 * schema.org-Auszeichnung, weil Antwortmaschinen zum Zeitpunkt der Frage live
 * crawlen.
 */
export const revalidate = 900;

type Params = { city: string; eventId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { city, eventId } = await params;
  const detail = await loadEventDetail(city, eventId);
  if (!detail) return { title: "Veranstaltung | PerfectDay24", robots: { index: false, follow: true } };

  const title = `${detail.event.title} — ${detail.dateLabel} in ${detail.cityLabel} | PerfectDay24`;
  const description =
    detail.before.length > 0 || detail.after.length > 0
      ? `${detail.event.title} am ${detail.dateLabel} um ${detail.startLabel} Uhr in ${detail.cityLabel}. Dazu Vorschläge, was davor und danach passt — als kompletter Tagesplan.`
      : `${detail.event.title} am ${detail.dateLabel} um ${detail.startLabel} Uhr in ${detail.cityLabel}.`;

  return {
    title,
    description,
    // Einzelne Veranstaltungen verfallen; ein Index voller toter Seiten wäre
    // der falsche Tausch. "follow" bleibt, damit die Links weiter zählen.
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      locale: "de_DE",
      type: "article",
      ...(detail.imageUrl ? { images: [{ url: detail.imageUrl }] } : {}),
    },
  };
}

/**
 * Eine Station auf der Zeitachse. Der Punkt links trägt die Uhrzeit, die Linie
 * verbindet die Stationen — die Dramaturgie des Abends soll man sehen, nicht
 * aus zwei Listen nebeneinander erschließen müssen.
 */
function TimelineRow({
  time,
  children,
  accent,
  emphasis = false,
  last = false,
}: {
  time: string;
  children: React.ReactNode;
  accent: string;
  emphasis?: boolean;
  last?: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[60px_1fr] gap-4 pb-6 last:pb-0 sm:grid-cols-[72px_1fr] sm:gap-6">
      {!last ? (
        <span
          aria-hidden
          className="absolute left-[59px] top-6 bottom-0 w-px bg-[var(--line-subtle)] sm:left-[71px]"
        />
      ) : null}

      <div className="pt-1 text-right text-sm tabular-nums text-[var(--text-muted)]">{time}</div>

      <div className="relative pl-6">
        <span
          aria-hidden
          className="absolute left-0 top-2 h-3 w-3 -translate-x-1/2 rounded-full ring-4 ring-[var(--bg-canvas)]"
          style={{ background: emphasis ? accent : "var(--line-strong)" }}
        />
        {children}
      </div>
    </li>
  );
}

function SuggestionBody({ suggestion }: { suggestion: AroundEventSuggestion }) {
  return (
    <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="text-sm font-semibold text-[var(--text-strong)]">{suggestion.name}</div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">
        {suggestion.walkMinutes} Min zu Fuß · {suggestion.distanceKm} km
      </div>
      {suggestion.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-muted-warm)]">
          {suggestion.description}
        </p>
      ) : null}
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<Params> }) {
  const { city, eventId } = await params;
  const detail = await loadEventDetail(city, eventId);
  if (!detail) notFound();

  const { event } = detail;
  const url = `${SITE_URL}/events/${city}/${eventId}`;
  const categoryLabel = plannerEventLabel(event.category as PlannerEventCategory);
  const accent = categoryAccent(event.category);

  // Der Übergabepunkt an den Planner: Stadt, Datum, Event und der Modus, der
  // die Event-Kandidaten überhaupt lädt — dazu der Veranstaltungsort als
  // Startpunkt. Ohne Startpunkt erzeugt der Planner gar keinen Plan, ohne Plan
  // gibt es keine Event-Kandidaten und damit auch keinen Anker.
  const startParams =
    typeof event.lat === "number" && typeof event.lng === "number"
      ? `&startLat=${event.lat}&startLng=${event.lng}` +
        `&startLabel=${encodeURIComponent(event.venue_name ?? event.title)}`
      : "";

  const plannerHref =
    `/planner?citySlug=${encodeURIComponent(city)}` +
    `&planDate=${detail.planDate}` +
    `&eventId=${encodeURIComponent(eventId)}` +
    `&experienceMode=event_visit` +
    startParams;

  const hasTimeline = detail.before.length > 0 || detail.after.length > 0;

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <JsonLd
        data={eventJsonLd({
          event: {
            title: event.title,
            summary: event.summary ?? null,
            start_at: event.start_at,
            end_at: event.end_at ?? null,
            venue_name: event.venue_name ?? null,
            venue_address: event.venue_address ?? null,
            lat: event.lat ?? null,
            lng: event.lng ?? null,
            ticket_url: event.ticket_url ?? null,
            source_url: event.source_url ?? null,
            price_min: event.price_min ?? null,
            price_max: event.price_max ?? null,
            currency: event.currency ?? null,
          },
          url,
          cityLabel: detail.cityLabel,
        })}
      />

      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/events" className="hover:text-[var(--text-strong)]">
          Veranstaltungen
        </Link>
        <span>/</span>
        <Link href={`/events/${city}`} className="hover:text-[var(--text-strong)]">
          {detail.cityLabel}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">{categoryLabel}</span>
      </nav>

      {/* ── Kopf ──────────────────────────────────────────────────────────
          Mit Bild, wenn die Quelle eines liefert — das tut nur Ticketmaster.
          Sonst trägt die Kategoriefarbe den Kopf, damit die Seite auch ohne
          Bild eine Haltung hat statt einer leeren Fläche. */}
      <section className="overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] shadow-[var(--shadow-large)]">
        <div className="relative">
          {detail.imageUrl ? (
            <div className="relative h-52 w-full sm:h-72">
              {/* Wechselnde Bildhosts der Ticket-Anbieter — nicht in der
                  next/image-Hostliste. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/35 to-transparent" />
            </div>
          ) : (
            <div
              className="h-28 w-full sm:h-32"
              style={{ background: `linear-gradient(135deg, ${accent}, var(--bg-canvas-warm))` }}
            />
          )}

          <div
            className={
              detail.imageUrl
                ? "absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8"
                : "bg-[var(--bg-surface)] p-6 sm:p-8"
            }
          >
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              style={{ background: accent }}
            >
              {categoryLabel}
            </span>

            <h1
              className={`mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl ${
                detail.imageUrl ? "" : "text-[var(--text-strong)]"
              }`}
            >
              {event.title}
            </h1>

            <div
              className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${
                detail.imageUrl ? "text-white/85" : "text-[var(--text-muted)]"
              }`}
            >
              <span className="font-medium">{detail.dateLabel}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {detail.startLabel}
                {detail.endLabel ? `–${detail.endLabel}` : ""} Uhr
              </span>
              {event.venue_name ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{event.venue_name}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] px-6 py-5 sm:px-8">
          {event.summary ? (
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted-warm)]">
              {event.summary}
            </p>
          ) : null}

          <div className={`flex flex-wrap gap-3 ${event.summary ? "mt-5" : ""}`}>
            <Link href={plannerHref} className="pd24-btn pd24-btn-primary">
              Tag um dieses Event planen
            </Link>
            {event.ticket_url ? (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="pd24-btn pd24-btn-secondary"
              >
                Tickets
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Zeitachse ─────────────────────────────────────────────────────
          Davor, Hauptmoment und Danach an einer durchgehenden Achse statt in
          zwei Listen nebeneinander: Der Ablauf des Abends soll ablesbar sein. */}
      {hasTimeline ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">
            Euer Abend, Schritt für Schritt
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Alles in Laufnähe zum Veranstaltungsort. Zeiten sind gerechnet, nicht
            reserviert — im Planner wird daraus ein vollständiger Ablauf.
          </p>

          <ol className="mt-6">
            {detail.before.map((suggestion) => (
              <TimelineRow key={suggestion.id} time={suggestion.timeLabel} accent={accent}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">
                  Davor
                </div>
                <SuggestionBody suggestion={suggestion} />
              </TimelineRow>
            ))}

            <TimelineRow
              time={detail.startLabel}
              accent={accent}
              emphasis
              last={detail.after.length === 0}
            >
              <div
                className="mb-1 text-xs font-semibold uppercase tracking-[0.1em]"
                style={{ color: accent }}
              >
                Hauptmoment
              </div>
              <div
                className="rounded-[var(--radius-card-sm)] border-l-2 bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)]"
                style={{ borderLeftColor: accent }}
              >
                <div className="text-base font-semibold text-[var(--text-strong)]">
                  {event.title}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {categoryLabel}
                  {event.venue_name ? ` · ${event.venue_name}` : ""}
                  {detail.endLabel ? ` · bis ${detail.endLabel} Uhr` : ""}
                </div>
              </div>
            </TimelineRow>

            {detail.after.map((suggestion, index) => (
              <TimelineRow
                key={suggestion.id}
                time={suggestion.timeLabel}
                accent={accent}
                last={index === detail.after.length - 1}
              >
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">
                  Danach
                </div>
                <SuggestionBody suggestion={suggestion} />
              </TimelineRow>
            ))}
          </ol>

          <div className="mt-2 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-4 py-3 text-sm leading-6 text-[var(--text-muted-warm)]">
            Im Planner wird daraus ein vollständiger Ablauf — mit Wegen,
            Zeitfenstern und Varianten, die ihr in der Gruppe abstimmen könnt.
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
          {detail.suggestionsUnavailable ??
            "Für diese Veranstaltung haben wir noch keine Vorschläge für davor und danach."}
        </p>
      )}
    </main>
  );
}
