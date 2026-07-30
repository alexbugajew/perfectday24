// lib/security/safe-url.ts
// Zentrale URL-Validierung. Deckt zwei Risikoklassen ab:
//   1. `javascript:` / `data:` in href-Attributen (Stored XSS)
//   2. Open Redirects über Query-Parameter
//
// Vorbild für (1) war `cleanUrl()` in components/ImageAttribution.tsx.

/** Externe Ziele: nur http/https, sonst null. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Wie safeExternalUrl, ergänzt aber ein fehlendes Schema ("www.lokal.de" →
 * "https://www.lokal.de"). OSM-Website-Tags kommen häufig ohne Schema.
 */
export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("/")) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeExternalUrl(candidate);
}

/** True, wenn der Wert eine gültige http(s)-URL ist. Für Schreibpfade/Formulare. */
export function isSafeExternalUrl(value: unknown): boolean {
  return safeExternalUrl(value) !== null;
}

// Steuerzeichen (inkl. CR/LF) koennen Header- und Location-Parsing
// beeinflussen. Bewusst ueber Zeichencodes statt Regex-Escapes geprueft,
// damit keine rohen Steuerbytes in der Quelldatei landen.
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Interne Redirect-Ziele: nur seitenrelative Pfade.
 * Blockt absolute URLs, protokollrelative `//host` und Backslash-Varianten,
 * mit denen sich Browser zu `//` überreden lassen.
 */
export function safeInternalPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (hasControlChars(trimmed)) return fallback;
  return trimmed;
}

/**
 * Hosts, zu denen die Monetization-Redirect-Route weiterleiten darf.
 * Ergänzbar über AFFILIATE_REDIRECT_ALLOWED_HOSTS (kommagetrennt), damit neue
 * Netzwerke ohne Deploy freigeschaltet werden können.
 */
const BUILTIN_REDIRECT_HOSTS = [
  // Affiliate-Netzwerke
  "awin1.com",
  "clk.tradedoubler.com",
  "tc.tradetracker.net",
  "track.webgains.com",
  "prf.hn",
  "tidd.ly",
  // Buchungs-/Ticketing-Partner
  "booking.com",
  "getyourguide.com",
  "eventbrite.de",
  "eventbrite.com",
  "eventim.de",
  "opentable.de",
  "thefork.de",
  // Hotel-Suchanbieter (HotelSearchLinks auf Roadtrip-Seiten)
  "hrs.de",
  "hotels.com",
  "hostelworld.com",
];

/**
 * Env-freie Host-Prüfung für Client-Bundles: entscheidet nur über die
 * Builtin-Liste, damit Server- und Client-Render identisch urteilen
 * (AFFILIATE_REDIRECT_ALLOWED_HOSTS existiert im Browser nicht — ein per Env
 * freigeschalteter Host verlinkt dann direkt statt über die Redirect-Route,
 * was funktional gleichwertig ist).
 */
export function isBuiltinRedirectHost(value: unknown): boolean {
  const safe = safeExternalUrl(value);
  if (!safe) return false;
  const host = new URL(safe).hostname.toLowerCase();
  return (
    BUILTIN_REDIRECT_HOSTS.includes(host) ||
    BUILTIN_REDIRECT_HOSTS.some((entry) => host.endsWith(`.${entry}`))
  );
}

function allowedRedirectHosts(): Set<string> {
  const extra = (process.env.AFFILIATE_REDIRECT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...BUILTIN_REDIRECT_HOSTS, ...extra]);
}

export type RedirectTargetCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: "invalid_url" | "host_not_allowed"; host?: string };

/**
 * Prüft ein Redirect-Ziel gegen Protokoll **und** Host-Allowlist.
 * Subdomains erlaubter Hosts gelten mit (`www.booking.com` → `booking.com`).
 */
export function checkRedirectTarget(value: unknown): RedirectTargetCheck {
  const safe = safeExternalUrl(value);
  if (!safe) return { ok: false, reason: "invalid_url" };

  const host = new URL(safe).hostname.toLowerCase();
  const allowed = allowedRedirectHosts();

  const isAllowed =
    allowed.has(host) || [...allowed].some((entry) => host.endsWith(`.${entry}`));

  if (!isAllowed) return { ok: false, reason: "host_not_allowed", host };
  return { ok: true, url: safe, host };
}
