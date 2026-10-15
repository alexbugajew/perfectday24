"use client";

// components/events/EventMapExplorer.tsx
//
// Filter, Standort und Liste rund um die Event-Karte.
//
// Anders als die Listenseiten (EventBrowser) mit Zustand im Browser: Auf der
// Karte schaltet man Kategorien im Sekundentakt an und aus, ein Seitenwechsel
// pro Chip wäre dort zäh. Die Karte steht ohnehin auf noindex — für Crawler
// bleiben die Stadt- und Kategorieseiten die beständigen Flächen.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  distanceKm,
  EVENT_MAP_GROUPS,
  EVENT_MAP_RADIUS_STEPS,
  EVENT_MAP_WINDOWS,
  eventMapGroup,
  eventMapWindowDays,
  hasCoordinates,
  isInEventMapWindow,
  type EventMapGroupKey,
  type EventMapItem,
  type EventMapWindowSlug,
} from "@/lib/events/event-map";
import type { EventMapOrigin, EventMapPoint } from "./EventMap";
import { eventMapGlyphSvg } from "./eventMapGlyphs";

const EventMap = dynamic(() => import("./EventMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-panel)] text-sm text-[var(--text-muted)]">
      Karte wird geladen …
    </div>
  ),
});

type CityPoint = { slug: string; label: string; lat: number; lng: number };

type Props = {
  citySlug: string;
  cityLabel: string;
  center: { lat: number; lng: number };
  cityRadiusKm: number;
  items: EventMapItem[];
  truncated: boolean;
  /** Zeitpunkt des Seitenaufbaus — Startwert für „jetzt", damit Server und Browser gleich rendern. */
  renderedAtMs: number;
  /** Städte mit Event-Seiten, um bei weit entferntem Standort die nähere anzubieten. */
  cities: CityPoint[];
};

type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; lat: number; lng: number; distanceKm: number }
  | { status: "far"; distanceKm: number; nearest: (CityPoint & { distanceKm: number }) | null }
  | { status: "denied" | "unavailable" | "unsupported" };

const LIST_PAGE = 20;

// „Jetzt" auf die Minute gerundet: Die Seite wird bis zu 15 Minuten aus dem
// Cache ausgeliefert, und was in der Zwischenzeit vorbei ist, soll nicht mehr
// erscheinen. Gerundet bleibt der Wert innerhalb einer Minute stabil — eine
// Voraussetzung für useSyncExternalStore.
function minuteNow(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function subscribeMinute(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}

function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1).replace(".", ",") : String(Math.round(km));
}

function chipClass(active: boolean) {
  return [
    "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm transition",
    active
      ? "border-transparent bg-[var(--text-strong)] font-medium text-white"
      : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
  ].join(" ");
}

export default function EventMapExplorer({
  citySlug,
  cityLabel,
  center,
  cityRadiusKm,
  items,
  truncated,
  renderedAtMs,
  cities,
}: Props) {
  const nowMs = useSyncExternalStore(subscribeMinute, minuteNow, () => renderedAtMs);

  const [windowSlug, setWindowSlug] = useState<EventMapWindowSlug>("14-tage");
  const [activeGroups, setActiveGroups] = useState<Set<EventMapGroupKey>>(
    () => new Set(EVENT_MAP_GROUPS.map((group) => group.key))
  );
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [radiusIndex, setRadiusIndex] = useState(EVENT_MAP_RADIUS_STEPS.length - 1);
  const [listLimit, setListLimit] = useState(LIST_PAGE);

  const radiusKm = EVENT_MAP_RADIUS_STEPS[radiusIndex] ?? null;
  const origin: EventMapOrigin =
    location.status === "ok"
      ? { lat: location.lat, lng: location.lng, kind: "user" }
      : { lat: center.lat, lng: center.lng, kind: "center" };

  // Nur Gruppen anbieten, die in den 14 Tagen überhaupt vorkommen — ein Chip
  // ohne jede Chance auf Treffer wäre nur Rauschen.
  const presentGroups = useMemo(() => {
    const present = new Set(items.map((item) => item.group));
    return EVENT_MAP_GROUPS.filter((group) => present.has(group.key));
  }, [items]);

  const inWindow = useMemo(() => {
    const days = eventMapWindowDays(windowSlug, nowMs);
    return items.filter((item) => isInEventMapWindow(item, days, nowMs));
  }, [items, windowSlug, nowMs]);

  // Was der Umkreis zulässt. Events ohne Koordinaten lassen sich keinem
  // Umkreis zuordnen; sie bleiben in der Liste unter der Karte, statt still zu
  // verschwinden.
  const reachable = useMemo(
    () =>
      inWindow.filter(
        (item) =>
          !hasCoordinates(item) || radiusKm == null || distanceKm({ lat: origin.lat, lng: origin.lng }, item) <= radiusKm
      ),
    [inWindow, radiusKm, origin.lat, origin.lng]
  );

  const countsByGroup = useMemo(() => {
    const counts = new Map<EventMapGroupKey, number>();
    for (const item of reachable) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
    return counts;
  }, [reachable]);

  const visible = useMemo(() => reachable.filter((item) => activeGroups.has(item.group)), [reachable, activeGroups]);
  const mapItems = useMemo(() => visible.filter(hasCoordinates) as EventMapPoint[], [visible]);
  const withoutLocation = useMemo(() => visible.filter((item) => !hasCoordinates(item)), [visible]);

  const allGroupsActive = presentGroups.every((group) => activeGroups.has(group.key));
  const fitKey = `${windowSlug}|${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${radiusKm ?? "alle"}`;

  const toggleGroup = useCallback((key: EventMapGroupKey) => {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({ status: "unsupported" });
      return;
    }
    setLocation({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        const fromCenter = distanceKm(center, here);
        // Weit außerhalb der Stadt ergibt ein Umkreis um den Standort hier
        // keinen Sinn — dann ehrlich sagen und die nähere Stadt anbieten.
        if (fromCenter > cityRadiusKm + 15) {
          const nearest = cities
            .map((city) => ({ ...city, distanceKm: distanceKm(here, city) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)[0];
          setLocation({
            status: "far",
            distanceKm: fromCenter,
            nearest: nearest && nearest.slug !== citySlug ? nearest : null,
          });
          return;
        }
        setLocation({ status: "ok", lat: here.lat, lng: here.lng, distanceKm: fromCenter });
        // Wer „in meiner Nähe" drückt, will einen Umkreis sehen, nicht die ganze Stadt.
        setRadiusIndex((index) =>
          EVENT_MAP_RADIUS_STEPS[index] == null ? EVENT_MAP_RADIUS_STEPS.indexOf(5) : index
        );
      },
      (error) => {
        setLocation({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, [center, cityRadiusKm, cities, citySlug]);

  const resetLocation = useCallback(() => setLocation({ status: "idle" }), []);

  const locationNote = (() => {
    switch (location.status) {
      case "idle":
        return `Entfernungen ab Stadtmitte ${cityLabel}.`;
      case "locating":
        return "Standort wird ermittelt …";
      case "ok":
        return "Entfernungen ab deinem Standort.";
      case "far":
        return `Du bist rund ${formatKm(location.distanceKm)} km von ${cityLabel} entfernt — wir messen deshalb weiter ab Stadtmitte.`;
      case "denied":
        return `Standortfreigabe abgelehnt — wir messen ab Stadtmitte ${cityLabel}. Die Freigabe lässt sich in den Browser-Einstellungen ändern.`;
      case "unavailable":
        return `Standort ließ sich nicht ermitteln — wir messen ab Stadtmitte ${cityLabel}.`;
      case "unsupported":
        return `Dein Browser gibt keinen Standort heraus — wir messen ab Stadtmitte ${cityLabel}.`;
    }
  })();

  const mapHint = (() => {
    if (items.length === 0) {
      return `Für ${cityLabel} liegen uns in den nächsten 14 Tagen keine Veranstaltungen vor.`;
    }
    if (mapItems.length > 0) return null;
    if (withoutLocation.length > 0) {
      return `Für diese Auswahl haben unsere Quellen keinen genauen Ort geliefert — ${withoutLocation.length} ${
        withoutLocation.length === 1 ? "Veranstaltung steht" : "Veranstaltungen stehen"
      } in der Liste unter der Karte.`;
    }
    if (activeGroups.size === 0) return "Alle Kategorien sind ausgeschaltet.";
    return radiusKm != null
      ? "In diesem Umkreis liegt für die Auswahl nichts — ein größerer Umkreis oder Zeitraum hilft."
      : "Für diese Auswahl liegt nichts vor — ein anderer Zeitraum oder andere Kategorien helfen.";
  })();

  const radiusLabel = radiusKm == null ? "ganze Stadt" : `${radiusKm} km`;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filter ───────────────────────────────────────────────────────
          Mobil als wischbare Reihen: Untereinander gestapelt schöben sieben
          Chips die Karte unter den sichtbaren Bereich. */}
      <div className="flex flex-col gap-3">
        <div className="pd24-scrollbar-none -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Zeitraum">
          {EVENT_MAP_WINDOWS.map((window) => (
            <button
              key={window.slug}
              type="button"
              aria-pressed={window.slug === windowSlug}
              onClick={() => {
                setWindowSlug(window.slug);
                setListLimit(LIST_PAGE);
              }}
              className={chipClass(window.slug === windowSlug)}
            >
              {window.label}
            </button>
          ))}
        </div>

        {presentGroups.length > 0 ? (
          <div className="pd24-scrollbar-none -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Kategorien ein- und ausschalten">
            {presentGroups.map((group) => {
              const active = activeGroups.has(group.key);
              const count = countsByGroup.get(group.key) ?? 0;
              return (
                <button
                  key={group.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGroup(group.key)}
                  className={[
                    "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 pr-3 text-sm transition",
                    active
                      ? "border-[var(--line-strong)] bg-white text-[var(--text-strong)] shadow-[var(--shadow-soft)]"
                      : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-soft)] line-through decoration-[var(--line-strong)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: active ? group.color : "var(--text-soft)" }}
                    dangerouslySetInnerHTML={{ __html: eventMapGlyphSvg(group.key, 13) }}
                  />
                  {group.label}
                  <span className={`tabular-nums ${count === 0 ? "opacity-50" : "opacity-70"}`}>{count}</span>
                </button>
              );
            })}
            {!allGroupsActive ? (
              <button
                type="button"
                onClick={() => setActiveGroups(new Set(EVENT_MAP_GROUPS.map((group) => group.key)))}
                className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-strong)]"
              >
                Alle zeigen
              </button>
            ) : null}
          </div>
        ) : null}

        {/* ── Standort und Umkreis ───────────────────────────────────────
            Mobil Knopf und Regler nebeneinander, der Hinweis darunter;
            ab sm alles in einer Zeile. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_16rem] sm:gap-x-5 sm:p-4">
          {location.status === "ok" ? (
            <button type="button" onClick={resetLocation} className="pd24-btn pd24-btn-sm pd24-btn-secondary">
              Ab Stadtmitte
            </button>
          ) : (
            <button
              type="button"
              onClick={locate}
              disabled={location.status === "locating"}
              className="pd24-btn pd24-btn-sm pd24-btn-primary"
            >
              {location.status === "locating" ? "Suche …" : "In meiner Nähe"}
            </button>
          )}

          <label className="col-start-2 flex min-w-0 flex-col gap-1 sm:col-start-3 sm:row-start-1">
            <span className="flex items-baseline justify-between text-sm">
              <span className="text-[var(--text-muted)]">Umkreis</span>
              <span className="font-medium tabular-nums text-[var(--text-strong)]">{radiusLabel}</span>
            </span>
            <input
              type="range"
              min={0}
              max={EVENT_MAP_RADIUS_STEPS.length - 1}
              step={1}
              value={radiusIndex}
              onChange={(event) => setRadiusIndex(Number(event.target.value))}
              aria-valuetext={radiusLabel}
              className="w-full accent-[var(--text-strong)]"
            />
          </label>

          <p
            className="col-span-2 text-xs leading-5 text-[var(--text-muted)] sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:text-sm"
            role="status"
            aria-live="polite"
          >
            {locationNote}
            {location.status === "far" && location.nearest ? (
              <>
                {" "}
                <Link
                  href={`/events/${location.nearest.slug}/karte`}
                  className="font-medium text-[var(--text-strong)] underline underline-offset-2"
                >
                  Karte für {location.nearest.label} öffnen
                </Link>{" "}
                ({location.nearest.distanceKm < 1 ? "direkt bei dir" : `${formatKm(location.nearest.distanceKm)} km entfernt`})
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* ── Karte ──────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-[var(--text-strong)]">
            {mapItems.length} {mapItems.length === 1 ? "Veranstaltung" : "Veranstaltungen"} auf der Karte
            {radiusKm != null ? ` im Umkreis von ${radiusKm} km` : ""}
          </span>
          {withoutLocation.length > 0 ? (
            <a href="#ohne-ort" className="text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-strong)]">
              {withoutLocation.length} ohne genauen Ort
            </a>
          ) : null}
        </div>

        <div className="relative h-[62vh] max-h-[560px] min-h-[360px] overflow-hidden rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] shadow-[var(--shadow-soft)] sm:h-[560px]">
          <EventMap
            citySlug={citySlug}
            center={center}
            cityRadiusKm={cityRadiusKm}
            items={mapItems}
            origin={origin}
            radiusKm={radiusKm}
            fitKey={fitKey}
            nowMs={nowMs}
          />
          {mapHint ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-8 z-[1] flex justify-center">
              <p className="pointer-events-auto max-w-md rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white/95 px-4 py-3 text-center text-sm leading-5 text-[var(--text-strong)] shadow-[var(--shadow-large)]">
                {mapHint}
              </p>
            </div>
          ) : null}
        </div>

        {truncated ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Die Karte zeigt die ersten 2.000 Veranstaltungen dieser Stadt; weitere sind in der Liste der Stadt.
          </p>
        ) : null}
      </div>

      {/* ── Ohne genauen Ort ───────────────────────────────────────────── */}
      {withoutLocation.length > 0 ? (
        <section id="ohne-ort" className="scroll-mt-24">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">
            {withoutLocation.length} weitere {withoutLocation.length === 1 ? "Veranstaltung" : "Veranstaltungen"} ohne genauen Ort
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Unsere Quellen nennen dafür keinen Ort mit Koordinaten. Deshalb fehlen sie auf der Karte, und der
            Umkreis lässt sich für sie nicht prüfen — Zeitraum und Kategorien gelten aber.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {withoutLocation.slice(0, listLimit).map((item) => {
              const group = eventMapGroup(item.group);
              return (
                <li key={item.id}>
                  <Link
                    href={`/events/${citySlug}/${item.id}`}
                    className="flex items-baseline gap-3 rounded-[var(--radius-card-sm)] border border-l-2 border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 transition hover:shadow-[var(--shadow-soft)]"
                    style={{ borderLeftColor: group.color }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                        {item.whenLabel} · {item.categoryLabel}
                        {item.venueName ? ` · ${item.venueName}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {withoutLocation.length > listLimit ? (
            <button
              type="button"
              onClick={() => setListLimit((limit) => limit + LIST_PAGE)}
              className="pd24-btn pd24-btn-sm pd24-btn-secondary mt-3"
            >
              Weitere {Math.min(LIST_PAGE, withoutLocation.length - listLimit)} anzeigen
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
