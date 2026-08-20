import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import { eventJsonLd, SITE_URL } from "@/lib/seo/json-ld";
import { loadEventDetail, type AroundEventSuggestion } from "@/lib/events/around-event";
import { plannerEventLabel } from "@/lib/planner";
import type { PlannerEventCategory } from "@/lib/planner/types";

/**
 * Detailseite einer Veranstaltung — und der eigentliche Grund, warum es die
 * Event-Strecke gibt.
 *
 * Eine reine Liste stünde gegen Eventim, Rausgegangen und die Stadtportale und
 * wäre schlechter als die Quellen, aus denen sie sich speist. Der Unterschied
 * entsteht hier: Das Event ist der Hauptmoment, darunter steht, was davor und
 * danach passt, und ein Klick übergibt beides an den Planner.
 *
 * Bewusst `noindex`: Veranstaltungen verfallen. Indexiert werden später die
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
    openGraph: { title, description, locale: "de_DE", type: "article" },
  };
}

function SuggestionCard({ suggestion, when }: { suggestion: AroundEventSuggestion; when: string }) {
  return (
    <li className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text-strong)]">{suggestion.name}</div>
        <div className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
          {when} {suggestion.timeLabel}
        </div>
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">
        {suggestion.walkMinutes} Min zu Fuß · {suggestion.distanceKm} km
      </div>
      {suggestion.description ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted-warm)]">
          {suggestion.description}
        </p>
      ) : null}
    </li>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<Params> }) {
  const { city, eventId } = await params;
  const detail = await loadEventDetail(city, eventId);
  if (!detail) notFound();

  const { event } = detail;
  const url = `${SITE_URL}/events/${city}/${eventId}`;
  const categoryLabel = plannerEventLabel(event.category as PlannerEventCategory);

  // Der Übergabepunkt an den Planner: Stadt, Datum und Event, dazu der Modus,
  // der die Event-Kandidaten überhaupt lädt.
  const plannerHref =
    `/planner?citySlug=${encodeURIComponent(city)}` +
    `&planDate=${detail.planDate}` +
    `&eventId=${encodeURIComponent(eventId)}` +
    `&experienceMode=event_visit`;

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

      <nav className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href={`/explore/${city}`} className="hover:text-[var(--text-strong)]">
          {detail.cityLabel}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">Veranstaltung</span>
      </nav>

      {/* ── Hauptmoment ── */}
      <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-large)] sm:p-8">
        <div className="pd24-kicker-warm">{categoryLabel} · Hauptmoment</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-4xl">
          {event.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-strong)]">{detail.dateLabel}</span>
          <span>·</span>
          <span className="tabular-nums">
            {detail.startLabel}
            {detail.endLabel ? ` – ${detail.endLabel}` : ""} Uhr
          </span>
          {event.venue_name ? (
            <>
              <span>·</span>
              <span>{event.venue_name}</span>
            </>
          ) : null}
        </div>

        {event.summary ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted-warm)]">
            {event.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
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
      </section>

      {/* ── Davor und Danach ── */}
      {detail.suggestionsUnavailable ? (
        <p className="mt-8 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
          {detail.suggestionsUnavailable}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {detail.before.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">Davor</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                In Laufnähe, mit genug Zeit bis zum Beginn.
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {detail.before.map((suggestion) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} when="ab" />
                ))}
              </ul>
            </section>
          ) : null}

          {detail.after.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">Danach</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Für den Ausklang, wenn die Veranstaltung vorbei ist.
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {detail.after.map((suggestion) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} when="ab ca." />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-8 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
        Die Vorschläge sind ein Anfang. Im Planner wird daraus ein vollständiger
        Ablauf — mit Wegen, Zeitfenstern und Varianten, die du mit deiner Gruppe
        abstimmen kannst.
      </p>
    </main>
  );
}
