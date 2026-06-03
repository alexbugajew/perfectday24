import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content, "utf8");
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function replaceEventsPage() {
  let text = read("app/events/page.tsx");

  text = text.replace(
    /const OCCASIONS = \[[\s\S]*?\] as const;/,
    `const OCCASIONS = [
  { slug: "geburtstag", label: "Geburtstag", hint: "Runde Geburtstage & private Feiern", emoji: "🎂" },
  { slug: "hochzeit", label: "Hochzeit", hint: "Trauung, Feier & Flitterwochen", emoji: "💍" },
  { slug: "teambuilding", label: "Teambuilding", hint: "Ausflüge & Aktivitäten für Teams", emoji: "🤝" },
  { slug: "firmenfeier", label: "Firmenfeier", hint: "Weihnachts-, Sommer- oder Jubiläumsfeier", emoji: "🥂" },
  { slug: "kindergeburtstag", label: "Kindergeburtstag", hint: "Feiern für die Kleinsten", emoji: "🎈" },
  { slug: "konferenz", label: "Konferenz", hint: "Fachveranstaltungen & Workshops", emoji: "🎤" },
  { slug: "jubilaeum", label: "Jubiläum", hint: "Runde Jahrestage & Meilensteine", emoji: "🏆" },
  { slug: "staedtereise", label: "Städtereise", hint: "Gruppenreisen mit kuratiertem Programm", emoji: "✈️" },
] as const;`,
  );

  const replacements = [
    [/label: "Catering \/ Men[^"]+"/g, `label: "Catering / Menü"`],
    [/label: "Teamaktivit[^"]+"/g, `label: "Teamaktivität"`],
    [/label: "Fingerfood \/ B[^"]+"/g, `label: "Fingerfood / Büfett"`],
    [/label: "Konferenzr[^"]+"/g, `label: "Konferenzräume"`],
    [/label: "Stadtf[^"]+"/g, `label: "Stadtführung"`],
    [/` Â· `/g, ` · `],
    [/Plan l[^"]*schen/g, `Plan löschen`],
    [/G[^"]*ste/g, `Gäste`],
    [/Anfragen & Angebote pruefen/g, `Anfragen & Angebote prüfen`],
    [/Plan wirklich l[^"]*schen\?/g, `Plan wirklich löschen?`],
    [/L[^"]*schen/g, `Löschen`],
    [/â€¦/g, `…`],
  ];

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  write("app/events/page.tsx", text);
}

function replaceDashboardPage() {
  let text = read("app/events/dashboard/page.tsx");

  text = text.replace(
    /const OCCASION_MAP: Record<string, \{ label: string; emoji: string \}> = \{[\s\S]*?\n\};/,
    `const OCCASION_MAP: Record<string, { label: string; emoji: string }> = {
  geburtstag: { label: "Geburtstag", emoji: "🎂" },
  hochzeit: { label: "Hochzeit", emoji: "💍" },
  teambuilding: { label: "Teambuilding", emoji: "🤝" },
  firmenfeier: { label: "Firmenfeier", emoji: "🥂" },
  kindergeburtstag: { label: "Kindergeburtstag", emoji: "🎈" },
  konferenz: { label: "Konferenz", emoji: "🎤" },
  jubilaeum: { label: "Jubiläum", emoji: "🏆" },
  staedtereise: { label: "Städtereise", emoji: "✈️" },
};`,
  );

  text = text.replace(
    /const m: Record<string, string> = \{[^}]+\};/,
    `const m: Record<string, string> = { muenchen: "München", koeln: "Köln", duesseldorf: "Düsseldorf" };`,
  );

  const replacements = [
    [/Event l[^"]*schen/g, `Event löschen`],
    [/G[^"]*ste/g, `Gäste`],
    [/Event dauerhaft l[^"]*schen\?/g, `Event dauerhaft löschen?`],
    [/Ja, l[^"]*schen/g, `Ja, löschen`],
    [/Event [^"]*ffnen/g, `Event öffnen`],
    [/Angebote pruefen/g, `Angebote prüfen`],
    [/â€¦/g, `…`],
  ];

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  write("app/events/dashboard/page.tsx", text);
}

function replacePlanDetailPage() {
  let text = read("app/events/plan/[id]/page.tsx");

  text = text.replace(/animation:\s+"[^"]+"/, `animation:  "Animation / Aktivität"`);
  text = text.replace(/jubilaeum:\s+"[^"]+"/, `jubilaeum:        "Jubiläum"`);
  text = text.replace(/staedtereise:\s+"[^"]+"/, `staedtereise:     "Städtereise"`);
  text = text.replace(/"muenchen":\s+"[^"]+"/, `"muenchen":         "München"`);
  text = text.replace(/"zuerich":\s+"[^"]+"/, `"zuerich":          "Zürich"`);
  text = text.replace(/"koeln":\s+"[^"]+"/, `"koeln":            "Köln"`);
  text = text.replace(/"duesseldorf":\s+"[^"]+"/, `"duesseldorf":      "Düsseldorf"`);

  text = text.replace(
    /function formatPrice\(totalCents: number, pkgPriceCents: number, unit: string\): string \{[\s\S]*?\n\}/,
    `function formatPrice(totalCents: number, pkgPriceCents: number, unit: string): string {
  const total = totalCents / 100;
  if (unit === "per_person") {
    const perPerson = pkgPriceCents / 100;
    return \`\${perPerson.toLocaleString("de-DE")} €/Person · \${total.toLocaleString("de-DE")} € gesamt\`;
  }
  return \`\${total.toLocaleString("de-DE")} €\`;
}`,
  );

  const replacements = [
    [/geh[^"]*rt/g, `gehört`],
    [/G[^"]*ste/g, `Gäste`],
    [/fuer/g, `für`],
    [/naechsten/g, `nächsten`],
    [/Zur Uebersicht/g, `Zur Übersicht`],
    [/Uebersicht/g, `Übersicht`],
    [/Naechster Schritt/g, `Nächster Schritt`],
    [/koennen/g, `können`],
    [/Anfragen & Angebote oeffnen/g, `Anfragen & Angebote öffnen`],
    [/ Â· /g, ` · `],
    [/G[^"]*nstigstes Angebot/g, `Günstigstes Angebot`],
    [/Verf[^"]*gbar [^<"]*/g, `Verfügbar ✓`],
    [/Nicht verf[^"]*gbar/g, `Nicht verfügbar`],
    [/Anbieter wurde benachrichtigt [^"]* Angebot ausstehend\./g, `Anbieter wurde benachrichtigt - Angebot ausstehend.`],
    [/Buche[^"]*/g, `Buche…`],
    [/R[^"]*ckmeldungen/g, `Rückmeldungen`],
    [/Anbieter erg[^"]*nzen [^<"]*/g, `Anbieter ergänzen →`],
    [/← Zur[^"]*ck zu Events/g, `← Zurück zu Events`],
    [/← Neuen Plan starten/g, `← Neuen Plan starten`],
    [/EUR/g, `€`],
    [/Wird gebucht\.\.\./g, `Wird gebucht …`],
    [/([^A-Za-z])Ã¼ber Budget/g, `$1über Budget`],
    [/„\{r\.message\}"/g, `„{r.message}“`],
  ];

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  text = text.replace(/>âœ“ Gebucht</g, `>✓ Gebucht<`);

  write("app/events/plan/[id]/page.tsx", text);
}

replaceEventsPage();
replaceDashboardPage();
replacePlanDetailPage();
