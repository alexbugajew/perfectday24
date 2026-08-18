// lib/analytics/events.ts
//
// Katalog der Funnel-Ereignisse für die Produkt- und Marketing-Analytics.
//
// Abgrenzung zu `lib/monetization`: Die Monetization-Attribution ist die
// interne, erstpartei-eigene Buchführung (welcher Partner, welcher Klick,
// welche Vergütung) und schreibt in die eigene Datenbank. Dieses Modul
// beantwortet die Marketing-Frage: Woher kommen Besucher und wie weit kommen
// sie im Funnel? Deshalb bewusst wenige, grobkörnige Ereignisse — jedes davon
// ist ein Ziel ("Goal"), auf das eine Kampagne optimiert werden kann.
//
// Regel für Properties: niedrige Kardinalität. Stadt-Slug und Anlass sind
// erlaubt, IDs, Tokens, E-Mail-Adressen oder Freitext nie — sie machen die
// Auswertung unbrauchbar und wären personenbeziehbar.

export const ANALYTICS_EVENTS = {
  /** Planner hat einen Plan mit mindestens einem Stopp erzeugt. Leitmetrik. */
  planGenerated: "plan_generated",
  /** Plan wurde dauerhaft gespeichert (setzt ein Konto voraus). */
  planSaved: "plan_saved",
  /** Nutzer hat einen Plan geteilt — der Kern des Wachstums-Loops. */
  planShared: "plan_shared",
  /** Ein geteilter Plan wurde von einem Gast geöffnet (Gegenstück zu planShared). */
  sharedPlanOpened: "shared_plan_opened",
  /** Gast hat einen geteilten Plan in den eigenen Planner übernommen. */
  sharedPlanCopied: "shared_plan_copied",
  /** Eine Gruppen-Einladung wurde geöffnet. */
  inviteOpened: "invite_opened",
  /** Redaktions-/Creator-Route wurde als Vorlage übernommen. */
  routeCopied: "route_copied",
  /** Registrierung abgeschlossen. */
  signupCompleted: "signup_completed",
  /** Stripe-Checkout gestartet (noch kein Abschluss — der kommt per Webhook). */
  checkoutStarted: "checkout_started",
  /** Partner-Interesse: Klick auf einen Akquise-CTA der Partnerseite. */
  partnerLead: "partner_lead",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Kanal, über den ein Plan geteilt wurde. */
export type ShareChannel = "link" | "chat" | "invite";

/**
 * Erlaubte Properties je Ereignis. Bewusst eng gehalten: Was hier nicht steht,
 * lehnt der Typecheck ab — das hält die Auswertung sauber.
 */
export type AnalyticsEventProps = {
  plan_generated: { city?: string | null; occasion?: string | null; mode?: string | null; stops?: number | null };
  plan_saved: { city?: string | null };
  plan_shared: { channel: ShareChannel; city?: string | null; group?: boolean };
  shared_plan_opened: { occasion?: string | null };
  shared_plan_copied: { city?: string | null };
  invite_opened: { occasion?: string | null };
  route_copied: { city?: string | null; target?: "planner_template" | "personalized_route" };
  signup_completed: { method: "email" | "google" | "azure" | "other" };
  checkout_started: {
    plan: "user_premium" | "partner_basic" | "partner_pro";
    interval?: "month" | "year";
  };
  partner_lead: { surface: string };
};
