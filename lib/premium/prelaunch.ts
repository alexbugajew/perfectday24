// Premium-Vorstart-Modus (Entscheidung 11.09.2026).
// ============================================================================
// Der Launch soll nicht auf die Stripe-Live-Umstellung warten (die hängt an
// der HRB-Eintragung der UG i. G.). Solange NEXT_PUBLIC_PREMIUM_PRELAUNCH
// gesetzt ist, zeigt das UpgradeModal statt des Checkouts einen
// „Vormerken"-Modus und der Checkout-Endpunkt ist geschlossen — sonst
// landeten echte Nutzer im Stripe-TESTMODUS (Testkarte = Gratis-Premium).
//
// Am HRB-Tag: Live-Keys in Vercel eintragen, diese Variable entfernen,
// Redeploy — und die Vormerker per Mail einladen (attribution_events mit
// event_type "lead", surface "upgrade_modal", metadata.kind
// "premium_waitlist" — der Typ-Constraint der Tabelle kennt keinen eigenen
// Waitlist-Typ, und DDL auf dem Launch-Pfad wäre eine unnötige Abhängigkeit).

export const PREMIUM_PRELAUNCH = process.env.NEXT_PUBLIC_PREMIUM_PRELAUNCH === "true";
