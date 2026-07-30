// lib/consent/index.ts
// Lightweight consent-state utility.
// Persisting the consent decision itself in localStorage is the one write
// that is allowed without prior consent — it IS the consent record.

export type ConsentState = "accepted" | "declined" | null;

const CONSENT_KEY = "pd24_tracking_consent";

// Bump this when the scope of the consented tracking changes materially —
// stored decisions with an older version are treated as "not decided yet"
// and the banner re-prompts.
const CONSENT_VERSION = 1;

// Storage keys written only after consent live under this prefix; on
// decline/withdrawal every matching key is purged (Art. 7 Abs. 3 DSGVO).
const TRACKING_STORAGE_PREFIX = "pd24_monetization";

/** Browser event that asks the ConsentBanner to show itself again. */
export const CONSENT_OPEN_EVENT = "pd24:consent-open";
/** Browser event fired after the user saved a (new) decision. */
export const CONSENT_CHANGED_EVENT = "pd24:consent-changed";

type StoredConsent = {
  state: Exclude<ConsentState, null>;
  version: number;
  updatedAt: string;
};

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    // Legacy format: plain "accepted" / "declined" string.
    if (raw === "accepted" || raw === "declined") {
      return { state: raw, version: 1, updatedAt: "" };
    }
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.state !== "accepted" && parsed.state !== "declined") return null;
    return {
      state: parsed.state,
      version: typeof parsed.version === "number" ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

/** Returns the stored decision, or null if the user hasn't decided yet. */
export function getConsentState(): ConsentState {
  const stored = readStored();
  if (!stored) return null;
  if (stored.version < CONSENT_VERSION) return null;
  return stored.state;
}

/** True only when the user explicitly accepted tracking. */
export function hasTrackingConsent(): boolean {
  return getConsentState() === "accepted";
}

/** Removes every consent-gated tracking key from local- and sessionStorage. */
function purgeTrackingStorage(): void {
  // Storage-Zugriff selbst kann werfen (blockierte Cookies, Private Mode) —
  // darf setConsent()/den Banner-Close nie mit einer Exception abbrechen.
  let stores: Storage[];
  try {
    stores = [window.localStorage, window.sessionStorage];
  } catch {
    return;
  }
  for (const storage of stores) {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(TRACKING_STORAGE_PREFIX)) doomed.push(key);
      }
      doomed.forEach((key) => storage.removeItem(key));
    } catch {}
  }
}

/**
 * Persist the user's decision (with timestamp + version as consent record).
 * Declining also wipes all previously written tracking IDs, so a withdrawal
 * takes effect immediately.
 */
export function setConsent(state: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  try {
    const record: StoredConsent = {
      state,
      version: CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // storage blocked (private mode, full quota) — silently ignore
  }
  if (state === "declined") purgeTrackingStorage();
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { state } }));
  } catch {}
}

/** Remove the stored decision (useful for testing or re-prompting). */
export function resetConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {}
}

/**
 * Asks the mounted ConsentBanner to reappear so the user can change or
 * withdraw an earlier decision ("Cookie-Einstellungen" links).
 */
export function openConsentBanner(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
  } catch {}
}
