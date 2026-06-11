type RoadtripHotelContext = {
  cityLabel: string;
  citySlug?: string | null;
  occasion?: string | null;
  budget?: string | null;
  planSummary?: string | null;
  anchorLabel?: string | null;
};

export type RoadtripHotelStayPick = {
  area: string;
  style: string;
  reason: string;
  searchQuery: string;
  badge: string;
  fitLabel: string;
};

const AREA_BY_CITY_SLUG: Record<string, string> = {
  berlin: "Mitte / Alexanderplatz",
  "berlin-berlin": "Mitte / Alexanderplatz",
  spreewald: "Luebbenau / Hafen",
  "hamburg-hamburg": "HafenCity / Speicherstadt",
  "muenchen": "Altstadt / Hauptbahnhof",
  "koeln": "Dom / Altstadt",
  "dresden": "Altstadt / Frauenkirche",
  "freiburg-im-breisgau": "Altstadt / Muenster",
  "salzburg-at": "Altstadt / Salzach",
  "strasbourg-fr": "Grande Ile / Petite France",
  "bergen-no": "Bryggen / Hafen",
  "seville-es": "Santa Cruz / Centro",
  "bolzano-it": "Centro / Altstadt",
  "ljubljana-si": "Altstadt / Flussufer",
  "rovinj-hr": "Altstadt / Hafen",
  "hallstatt-at": "Seeufer / Ortskern",
  "bregenz-at": "Seebuehne / Hafen",
  "konstanz-de": "Hafen / Altstadt",
  "trieste-it": "Piazza Unita / Centro",
  "innsbruck-at": "Altstadt / Inn",
  "leipzig": "Zentrum / Passage-Viertel",
  "nuernberg": "Altstadt / Hauptmarkt",
  "duesseldorf": "Altstadt / Rheinufer",
  "stuttgart": "Mitte / Schlossplatz",
  "bonn": "Altstadt / Rhein",
  "trier": "Porta Nigra / Altstadt",
  "rostock": "Warnemuende / Zentrum",
  "binz-ruegen": "Promenade / Seebruecke",
  "lindau-de": "Insel / Hafen",
  "cortina-dampezzo-it": "Centro / Bergblick",
};

function inferAreaFromAnchor(anchor: string | null | undefined): string | null {
  const value = anchor?.toLowerCase() ?? "";
  if (!value) return null;
  if (/(altstadt|old town|marktplatz|rathaus|dom|cathedral|zentrum|center|centre)/.test(value)) {
    return "Altstadt / Zentrum";
  }
  if (/(hafen|harbour|waterfront|river|rheinufer|ufer|canal|promenade|foerde|fjord)/.test(value)) {
    return "Hafen / Ufer";
  }
  if (/(see|lake|seebruecke|beach|strand|coast|promenade)/.test(value)) {
    return "Seeufer / Promenade";
  }
  if (/(schloss|castle|berg|mountain|view|mirador|pass|gorge|klamm)/.test(value)) {
    return "Ruhige Lage mit Aussicht";
  }
  return null;
}

function buildStyle(occasion?: string | null, budget?: string | null, area?: string | null): string {
  if (occasion === "family") return "Familienhotel oder Aparthotel";
  if (occasion === "date" && budget === "high") return "Boutique- oder Designhotel";
  if (budget === "high" && area?.includes("See")) return "Seehotel oder Spa-Hotel";
  if (budget === "high") return "Designhotel mit guter Abendlage";
  if (occasion === "friends") return "lebendiges Stadthotel";
  if (occasion === "tourism") return "zentrales Boutiquehotel";
  return "gut gelegenes Stadthotel";
}

function buildBadge(occasion?: string | null, budget?: string | null): string {
  if (occasion === "family") return "Familienfit";
  if (occasion === "date") return "Besonders stimmig";
  if (budget === "high") return "Premium Lage";
  return "Kurze Wege";
}

function buildFitLabel(occasion?: string | null, budget?: string | null): string {
  if (occasion === "family") return "Mehr Platz und entspannter Check-in";
  if (occasion === "date") return "Abendstimmung und gute Lage";
  if (budget === "high") return "Hochwertiger Stop-Fit";
  if (budget === "low") return "Praktisch und zentral";
  return "Direkt passend zur Route";
}

function buildReason(area: string, style: string, planSummary?: string | null): string {
  const summary = planSummary?.trim();
  if (summary) {
    return `${style} in ${area} passt gut, weil du von dort schnell zu den Route-Highlights kommst und den Stop ohne zusaetzliche Transfers starten kannst.`;
  }
  return `${style} in ${area} spart Wege, funktioniert fuer Check-in plus Abendprogramm und passt gut zum Rhythmus eines Roadtrip-Stopps.`;
}

export function getRoadtripHotelStayPick({
  cityLabel,
  citySlug,
  occasion,
  budget,
  planSummary,
  anchorLabel,
}: RoadtripHotelContext): RoadtripHotelStayPick {
  const area =
    (citySlug ? AREA_BY_CITY_SLUG[citySlug] : null) ??
    inferAreaFromAnchor(anchorLabel) ??
    inferAreaFromAnchor(planSummary) ??
    "Altstadt / Zentrum";
  const style = buildStyle(occasion, budget, area);
  const badge = buildBadge(occasion, budget);
  const fitLabel = buildFitLabel(occasion, budget);
  const reason = buildReason(area, style, planSummary);
  const searchQuery = `${cityLabel} ${area} ${style}`;

  return {
    area,
    style,
    reason,
    searchQuery,
    badge,
    fitLabel,
  };
}
