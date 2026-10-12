// Website und Telefon einer Location aus source_refs lesen.
// ============================================================================
// Gleicher Mechanismus wie bei Adresse (location-address.ts) und Foto
// (location-photo.ts): locations hat weder eine Website- noch eine
// Telefonspalte, und DDL läuft nur über Alex (Schema-Drift-Konvention). Der
// Kontakt-Backfill (scripts/backfill-location-contacts.ts) legt beides
// deshalb als {website, phone}-Eintrag in source_refs ab. source_refs steht
// bereits in der Planner-SELECT-Liste, die Werte fließen also ohne
// Query-Änderung bis in den „Mehr Info"-Aufklapper.
//
// Warum nicht reservation_url: Die Spalte steht für den Buchungs-/
// Reservierungsweg (Affiliate-Auflösung, „Reservieren"-Knopf). Eine
// Venue-Homepage dort abzulegen, vermischt beides — der Ingest hat das für
// OSM-Orte ohnehin schon getan (siehe Backfill-Kommentar).
//
// Das Feld hat zwei gewachsene Formen: ein Array aus Ref-Objekten
// (osm_seed-Locations) oder ein einzelnes Objekt — beide werden gelesen.

import { normalizeExternalUrl } from "../security/safe-url";

function textFromEntry(entry: unknown, key: "website" | "phone"): string | null {
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstText(refs: unknown, key: "website" | "phone"): string | null {
  if (!refs || typeof refs !== "object") return null;
  if (Array.isArray(refs)) {
    for (const entry of refs) {
      const text = textFromEntry(entry, key);
      if (text) return text;
    }
    return null;
  }
  return textFromEntry(refs, key);
}

/**
 * Website der Location. OSM-Tags sind öffentlich editierbar und oft ohne
 * Schema („www.lokal.de") — normalizeExternalUrl ergänzt https:// und lässt
 * alles außer http(s) (z. B. javascript:) durchfallen.
 */
export function locationWebsiteFromSourceRefs(refs: unknown): string | null {
  const raw = firstText(refs, "website");
  return raw ? normalizeExternalUrl(raw) : null;
}

/**
 * Telefonnummer für die Anzeige. OSM trennt mehrere Nummern mit „;" — die
 * erste genügt. Alles, was nicht wie eine Nummer aussieht, fliegt raus statt
 * als Müll im Aufklapper zu landen.
 */
export function cleanPhone(raw: string): string | null {
  const first = raw.split(";")[0]?.trim() ?? "";
  if (!/^\+?[\d\s()./-]+$/.test(first)) return null;
  const digits = first.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15 ? first : null;
}

export function locationPhoneFromSourceRefs(refs: unknown): string | null {
  const raw = firstText(refs, "phone");
  return raw ? cleanPhone(raw) : null;
}

/** tel:-Link zur (bereits bereinigten) Anzeige-Nummer. */
export function phoneHref(phone: string): string | null {
  const compact = phone.replace(/[^\d+]/g, "");
  return compact.replace(/\D/g, "").length >= 6 ? `tel:${compact}` : null;
}

function comparableTarget(value: string): string | null {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${url.search}`;
}

/**
 * Zeigen zwei Links auf dasselbe Ziel? Dient dazu, Website und
 * Reservierungslink nicht doppelt zu rendern, wenn der Ingest die
 * OSM-Website schon als reservation_url abgelegt hat.
 */
export function isSameWebTarget(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = comparableTarget(a);
  const right = comparableTarget(b);
  return left !== null && left === right;
}
