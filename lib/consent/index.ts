// lib/consent/index.ts
// Lightweight consent-state utility.
// Persisting the consent decision itself in localStorage is the one write
// that is allowed without prior consent — it IS the consent record.

export type ConsentState = "accepted" | "declined" | null;

const CONSENT_KEY = "pd24_tracking_consent";

/** Returns the stored decision, or null if the user hasn't decided yet. */
export function getConsentState(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(CONSENT_KEY);
    if (val === "accepted" || val === "declined") return val as ConsentState;
    return null;
  } catch {
    return null;
  }
}

/** True only when the user explicitly accepted tracking. */
export function hasTrackingConsent(): boolean {
  return getConsentState() === "accepted";
}

/** Persist the user's decision. */
export function setConsent(state: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // storage blocked (private mode, full quota) — silently ignore
  }
}

/** Remove the stored decision (useful for testing or re-prompting). */
export function resetConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {}
}
