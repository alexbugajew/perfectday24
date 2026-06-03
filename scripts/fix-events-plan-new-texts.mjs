import fs from "node:fs";

const file = "app/events/plan/new/page.tsx";
let text = fs.readFileSync(file, "utf8");

const replacements = [
  ["JubilÃ¤um", "Jubiläum"],
  ["StÃ¤dtereise", "Städtereise"],
  ["AktivitÃ¤t", "Aktivität"],
  ["AusflÃ¼ge & AktivitÃ¤ten fÃ¼r Teams", "Ausflüge & Aktivitäten für Teams"],
  ["Weihnachts-, Sommer- oder JubilÃ¤umsfeier", "Weihnachts-, Sommer- oder Jubiläumsfeier"],
  ["Feiern fÃ¼r die Kleinsten", "Feiern für die Kleinsten"],
  ["Catering / MenÃ¼", "Catering / Menü"],
  ["TeamaktivitÃ¤t", "Teamaktivität"],
  ["Fingerfood / BÃ¼fett", "Fingerfood / Büfett"],
  ["KonferenzrÃ¤ume", "Konferenzräume"],
  ["StadtfÃ¼hrung", "Stadtführung"],
  ["â† ZurÃ¼ck", "← Zurück"],
  ["Dienstleister fÃ¼r deinen", "Dienstleister für deinen"],
  ["GÃ¤ste", "Gäste"],
  ["â‚¬", "€"],
  ["Kein Bedarf ausgewÃ¤hlt.", "Kein Bedarf ausgewählt."],
  ["ZurÃ¼ck zum Wizard", "Zurück zum Wizard"],
  ["ausgewÃ¤hlt", "ausgewählt"],
  ["Weiter â†’", "Weiter →"],
  [" Â· ", " · "],
  ["ðŸ’¬", "💬"],
  ["+ PersÃ¶nliche Nachricht hinzufÃ¼gen", "+ Persönliche Nachricht hinzufügen"],
  ["Stil-WÃ¼nsche, Fragen â€¦", "Stil-Wünsche, Fragen …"],
  [" Ã¼ber Budget", " über Budget"],
  ["ðŸ¢", "🏢"],
  ["âœ“", "✓"],
  ["Event Planner", "Event-Planer"],
  ["Noch kein Partner in ", "Noch kein Partner in "],
  [" fÃ¼r diese Kategorie registriert.", " für diese Kategorie registriert."],
  ["Anbieter empfehlen â†’", "Anbieter empfehlen →"],
  ["Wird gespeichert â€¦", "Wird gespeichert …"],
  ["ausgewählt ✓", "ausgewählt ✓"],
  ["Ausgewählt ✓", "Ausgewählt ✓"],
  ["Anfrage vorgemerkt ✓", "Anfrage vorgemerkt ✓"],
  ["Preise werden angefragt", "Preise werden angefragt"],
];

for (const [from, to] of replacements) {
  text = text.split(from).join(to);
}

fs.writeFileSync(file, text, "utf8");
