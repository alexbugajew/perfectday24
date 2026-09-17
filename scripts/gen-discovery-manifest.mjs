import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2]; // Projekt-Root
const OUT = process.argv[3];  // Zielpfad lib/discovery-routes.ts

const files = [
  "marburg-grimm-dich-pfad-2026-09",
  "entdeckungspfade-wave1-2026-09",
  "entdeckungspfade-wave2-2026-09",
  "entdeckungspfade-wave3-2026-09",
  "entdeckungspfade-wave4-2026-09",
];
let routes = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(`${BASE}/data/editorial_routes/${f}.json`, "utf8"));
  routes = routes.concat(d.routes);
}

const cityMap = {
  "berlin-berlin": "Berlin", "hamburg-hamburg": "Hamburg", muenchen: "München",
  koeln: "Köln", muenster: "Münster", nuernberg: "Nürnberg", luebeck: "Lübeck",
  goettingen: "Göttingen", duesseldorf: "Düsseldorf", moenchengladbach: "Mönchengladbach",
  osnabrueck: "Osnabrück", fuerth: "Fürth", "offenbach-am-main": "Offenbach am Main",
  "muelheim-an-der-ruhr": "Mülheim an der Ruhr", "frankfurt-am-main": "Frankfurt am Main",
  "bergisch-gladbach": "Bergisch Gladbach",
};
const cityLabel = (s) =>
  cityMap[s] ?? s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

function themeOf(tags) {
  const t = new Set(tags || []);
  if (t.has("maerchen") || t.has("grimm") || t.has("literatur")) return "Märchen & Literatur";
  if (t.has("musik") || t.has("notenspur")) return "Musik";
  if (t.has("jugendstil") || t.has("architektur")) return "Architektur & Jugendstil";
  if (t.has("skulptur") || t.has("kunst") || t.has("brunnen")) return "Kunst im öffentlichen Raum";
  if (t.has("industriekultur") || t.has("bergbau")) return "Industriekultur";
  if (t.has("wissenschaft") || t.has("optik")) return "Wissenschaft & Forschung";
  if (t.has("roemer") || t.has("unesco") || t.has("mauer") || t.has("zeitgeschichte") ||
      t.has("reformation") || t.has("luther") || t.has("demokratie") || t.has("gutenberg") ||
      t.has("buchdruck") || t.has("karl-der-grosse") || t.has("mittelalter") || t.has("festung") ||
      t.has("wasser") || t.has("juedisches-leben") || t.has("gold") || t.has("kunsthandwerk"))
    return "Geschichte & Zeitgeschichte";
  return "Stadt & Altstadt";
}
function teaser(desc) {
  const s = (desc || "").split(/(?<=[.!?:])\s/)[0].trim();
  return s.length > 140 ? s.slice(0, 137).trim() + "…" : s;
}

const order = [
  "Märchen & Literatur", "Musik", "Kunst im öffentlichen Raum", "Architektur & Jugendstil",
  "Geschichte & Zeitgeschichte", "Industriekultur", "Wissenschaft & Forschung", "Stadt & Altstadt",
];
const items = routes.map((r) => ({
  slug: r.slug, city: cityLabel(r.citySlug), title: r.title,
  theme: themeOf(r.tags), teaser: teaser(r.description),
}));
items.sort((a, b) => {
  const d = order.indexOf(a.theme) - order.indexOf(b.theme);
  return d !== 0 ? d : a.city.localeCompare(b.city, "de");
});
const counts = {};
items.forEach((i) => (counts[i.theme] = (counts[i.theme] || 0) + 1));
const themes = order.filter((o) => counts[o]);

let ts = "";
ts += "// Manifest der redaktionellen Entdeckungspfade (Owner pd24-redaktion).\n";
ts += "// Generiert aus data/editorial_routes/*.json. Die Hub-Seite /entdeckungsrouten\n";
ts += "// verlinkt daraus alle Routen — interne Verlinkung fuers SEO + Browse-Einstieg.\n";
ts += "// Neu erzeugen: node scripts/gen-discovery-manifest.mjs (bei neuen Wellen).\n\n";
ts += "export type DiscoveryRoute = {\n  slug: string;\n  city: string;\n  title: string;\n  theme: string;\n  teaser: string;\n};\n\n";
ts += "export const DISCOVERY_THEMES = [\n" + themes.map((o) => "  " + JSON.stringify(o) + ",").join("\n") + "\n] as const;\n\n";
ts += "export const DISCOVERY_ROUTES: DiscoveryRoute[] = [\n";
ts += items.map((i) =>
  "  { slug: " + JSON.stringify(i.slug) + ", city: " + JSON.stringify(i.city) +
  ", title: " + JSON.stringify(i.title) + ", theme: " + JSON.stringify(i.theme) +
  ", teaser: " + JSON.stringify(i.teaser) + " },"
).join("\n");
ts += "\n];\n";

writeFileSync(OUT, ts);
console.log("Routen:", items.length);
themes.forEach((o) => console.log("  " + o + ": " + counts[o]));
console.log("Geschrieben:", OUT, "(" + ts.length + " Bytes)");
