// lib/legal/anbieter.ts
//
// Anbieterdaten an genau einer Stelle. Impressum, Datenschutzerklärung und AGB
// müssen dieselbe Firma, Anschrift und Vertretung nennen — drei gepflegte
// Kopien laufen auseinander, sobald sich eine Angabe ändert, und eine
// widersprüchliche Anbieterkennzeichnung ist schlechter als gar keine.
//
// Noch fehlende Angaben stehen bewusst als OFFEN und werden auf der Seite
// sichtbar als Lücke ausgezeichnet — nicht als leeres Feld, das man für
// fertig hält.

/** Marker für eine Angabe, die noch nicht vorliegt. */
export const OFFEN = "__OFFEN__" as const;

export function istOffen(wert: string): boolean {
  return wert === OFFEN;
}

/**
 * Die Gesellschaft ist beurkundet, aber noch nicht im Handelsregister
 * eingetragen. Bis dahin gilt:
 *
 *  - Die Firma MUSS den Zusatz „i. G." tragen. Ohne ihn liegt unzulaessiger
 *    Firmengebrauch vor, weil eine noch nicht existierende Haftungs-
 *    beschraenkung vorgespiegelt wird.
 *  - Nach § 11 Abs. 2 GmbHG haftet persoenlich und unbeschraenkt, wer vor der
 *    Eintragung im Namen der Gesellschaft handelt. Die Haftung erlischt erst
 *    mit der Eintragung.
 *
 * Nach Eintragung: auf false setzen und die HRB-Nummer eintragen. Beides
 * gehoert zusammen — der Zusatz darf nicht vor der Nummer verschwinden.
 *
 * Eingetragen am 18.09.2026 im Handelsregister B des Amtsgerichts Marburg,
 * HRB 9074 (Gesellschaftsvertrag vom 27.08.2026). Damit endet die
 * Gruendungsphase: kein „i. G."-Zusatz mehr, HRB-Nummer unten gesetzt.
 */
export const IN_GRUENDUNG = false;

export const ANBIETER = {
  /**
   * Der Zusatz „(haftungsbeschränkt)" ist nach § 5a Abs. 1 GmbHG zwingender
   * Bestandteil der Firma. Wird er weggelassen oder abgekürzt, haftet nach
   * ständiger BGH-Rechtsprechung der Handelnde — in der Regel der
   * Geschäftsführer — persönlich aus Rechtsschein. Niemals zu „UG" kürzen.
   */
  firma: "PerfectDay24 UG (haftungsbeschränkt)",
  strasse: "Tulpenweg 14",
  plzOrt: "35085 Ebsdorfergrund",
  land: "Deutschland",

  /**
   * Vertretungsberechtigt ist immer die natuerliche Person, die als
   * Geschaeftsfuehrer bestellt ist — nach § 6 Abs. 2 GmbHG (ueber § 5a auch
   * fuer die UG) kann das keine Gesellschaft sein. Eine Holding waere
   * Gesellschafterin, nicht Vertreterin; Gesellschafter gehoeren nach
   * § 5 DDG ohnehin nicht ins Impressum.
   */
  vertretenDurch: "Alex Bugajew",
  email: "perfectday24@gmail.com",

  /** Ebsdorfergrund gehört zum Registerbezirk des Amtsgerichts Marburg. */
  registergericht: "Amtsgericht Marburg",
  registernummer: "HRB 9074",

  ustIdNr: OFFEN,
} as const;

/**
 * Zuständige Datenschutz-Aufsichtsbehörde, bestimmt durch den Sitz der
 * Gesellschaft in Hessen — nicht durch den Gerichtsbezirk.
 *
 * Achtung: Die Behörde ist im März 2026 umgezogen. Ältere Vorlagen führen noch
 * den Gustav-Stresemann-Ring 1; geprüft am 26.08.2026 gegen das Impressum
 * unter datenschutz.hessen.de.
 */
export const DATENSCHUTZ_AUFSICHT = {
  name: "Der Hessische Beauftragte für Datenschutz und Informationsfreiheit",
  strasse: "Wilhelmstraße 7",
  plzOrt: "65185 Wiesbaden",
  telefon: "0611 1408-0",
  email: "poststelle@datenschutz.hessen.de",
  web: "https://datenschutz.hessen.de",
} as const;

/**
 * Verbraucherstreitbeilegung.
 *
 * Eine Teilnahmepflicht besteht nur in eigens regulierten Branchen (Energie,
 * Luftverkehr, Banken und Zahlungsdienste, Versicherungen, Telekommunikation).
 * Eine Freizeitplanungs-Plattform gehört nicht dazu.
 *
 * Die Informationspflicht aus § 36 VSBG trifft ohnehin nur Unternehmen mit
 * mehr als zehn Beschäftigten (Stichtag 31.12. des Vorjahres). Die Angabe
 * bleibt trotzdem stehen: Sie kostet nichts, beseitigt jede Unklarheit und
 * bleibt richtig, falls die Gesellschaft wächst.
 */
export const VSBG_BEREIT = false;

/**
 * Firmenname so, wie er nach aussen auftreten muss — inklusive „i. G.",
 * solange die Eintragung laeuft. Ueberall verwenden, wo die Firma genannt
 * wird; ANBIETER.firma ist nur der Stammname.
 */
export const FIRMA_ANZEIGE = IN_GRUENDUNG
  ? `${ANBIETER.firma} i. G.`
  : ANBIETER.firma;
