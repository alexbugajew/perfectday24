import { canonicalCitySlug } from "@/lib/cities/canonical";

export type CityLookupRow = {
  slug: string;
  name: string;
  country_code: string | null;
};

export function countryLabel(code: string | null | undefined) {
  if (!code) return "Unbekannt";
  const upper = code.toUpperCase();
  if (upper === "DE") return "Deutschland";
  if (upper === "AT") return "Oesterreich";
  if (upper === "CH") return "Schweiz";
  if (upper === "FR") return "Frankreich";
  if (upper === "IT") return "Italien";
  if (upper === "ES") return "Spanien";
  if (upper === "NL") return "Niederlande";
  if (upper === "BE") return "Belgien";
  if (upper === "GB" || upper === "UK") return "Vereinigtes Koenigreich";
  if (upper === "US") return "USA";
  return upper;
}

function citySlugFallbackLabel(citySlug: string) {
  const canonical = canonicalCitySlug(citySlug) ?? citySlug;
  const specialLabels: Record<string, string> = {
    berlin: "Berlin",
    hamburg: "Hamburg",
    muenchen: "Muenchen",
    koeln: "Koeln",
    duesseldorf: "Duesseldorf",
    "frankfurt-am-main": "Frankfurt am Main",
    leipzig: "Leipzig",
    dresden: "Dresden",
    hannover: "Hannover",
    nuernberg: "Nuernberg",
    bremen: "Bremen",
    stuttgart: "Stuttgart",
    dortmund: "Dortmund",
    essen: "Essen",
  };

  if (specialLabels[canonical]) {
    return specialLabels[canonical];
  }

  const label = canonical
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const dedupedWords = label
    .split(/\s+/)
    .filter((word, index, words) => index === 0 || word.toLowerCase() !== words[index - 1]?.toLowerCase());

  return dedupedWords.join(" ");
}

export function buildCityLookupMap(cities: CityLookupRow[]) {
  const map = new Map<string, CityLookupRow>();

  for (const city of cities) {
    map.set(city.slug, city);

    const canonicalSlug = canonicalCitySlug(city.slug);
    if (canonicalSlug) {
      map.set(canonicalSlug, { ...city, slug: canonicalSlug });
    }
  }

  return map;
}

export function formatCityWithCountry(
  citySlug: string | null | undefined,
  cityMap: Map<string, CityLookupRow>
) {
  if (!citySlug) return "ohne Stadt";

  const canonicalSlug = canonicalCitySlug(citySlug) ?? citySlug;
  const city = cityMap.get(citySlug) ?? cityMap.get(canonicalSlug);

  if (!city) {
    return citySlugFallbackLabel(canonicalSlug);
  }

  return city.country_code ? `${city.name}, ${countryLabel(city.country_code)}` : city.name;
}
