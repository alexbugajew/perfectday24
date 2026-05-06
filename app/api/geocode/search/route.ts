import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canonicalCitySlug } from "@/lib/cities/canonical";

type SearchSuggestion = {
  label: string;
  lat: number;
  lng: number;
  type: "address" | "hotel" | "station" | "airport" | "other";
  source: "location" | "city" | "preset";
  citySlug: string | null;
  subtitle: string | null;
};

type CityStartPreset = {
  label: string;
  lat: number;
  lng: number;
  type: SearchSuggestion["type"];
  subtitle: string;
  aliases: string[];
};

const CITY_PRESET_SUGGESTIONS: Record<string, CityStartPreset[]> = {
  "berlin-berlin": [
    {
      label: "Alexanderplatz",
      lat: 52.521918,
      lng: 13.413215,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["alexanderplatz", "berlin mitte", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Berlin Hauptbahnhof",
      lat: 52.525084,
      lng: 13.369402,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["berlin hauptbahnhof", "berlin hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Berlin Brandenburg",
      lat: 52.366667,
      lng: 13.503333,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["ber", "berlin flughafen", "flughafen", "airport", "brandenburg airport"],
    },
  ],
  hamburg: [
    {
      label: "Binnenalster",
      lat: 53.55492,
      lng: 9.99353,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["binnenalster", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Hamburg Hauptbahnhof",
      lat: 53.552559,
      lng: 10.006342,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["hamburg hauptbahnhof", "hamburg hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Hamburg Airport",
      lat: 53.630389,
      lng: 9.988228,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["hamburg airport", "hamburg flughafen", "flughafen", "airport"],
    },
  ],
  muenchen: [
    {
      label: "Marienplatz",
      lat: 48.137393,
      lng: 11.575448,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["marienplatz", "altstadt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Muenchen Hauptbahnhof",
      lat: 48.140228,
      lng: 11.558335,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["muenchen hauptbahnhof", "muenchen hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Muenchen",
      lat: 48.353783,
      lng: 11.786086,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["muenchen flughafen", "munich airport", "flughafen", "airport"],
    },
  ],
  koeln: [
    {
      label: "Koeln Altstadt / Dom",
      lat: 50.941278,
      lng: 6.958281,
      type: "address",
      subtitle: "Altstadt (Preset)",
      aliases: ["koeln altstadt", "dom", "altstadt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Koeln Hauptbahnhof",
      lat: 50.94303,
      lng: 6.958729,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["koeln hauptbahnhof", "koeln hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Koeln/Bonn",
      lat: 50.865917,
      lng: 7.142744,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["koeln bonn flughafen", "cgn", "flughafen", "airport"],
    },
  ],
  "frankfurt-am-main": [
    {
      label: "Roemerberg",
      lat: 50.110306,
      lng: 8.682089,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["roemerberg", "romerberg", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Frankfurt (Main) Hauptbahnhof",
      lat: 50.107145,
      lng: 8.663789,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["frankfurt hauptbahnhof", "frankfurt hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Frankfurt",
      lat: 50.037933,
      lng: 8.562152,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["frankfurt flughafen", "frankfurt airport", "fra", "flughafen", "airport"],
    },
  ],
  duesseldorf: [
    {
      label: "Duesseldorf Altstadt",
      lat: 51.227742,
      lng: 6.773456,
      type: "address",
      subtitle: "Altstadt (Preset)",
      aliases: ["duesseldorf altstadt", "altstadt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Duesseldorf Hauptbahnhof",
      lat: 51.219921,
      lng: 6.794642,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["duesseldorf hauptbahnhof", "duesseldorf hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Duesseldorf",
      lat: 51.289508,
      lng: 6.766782,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["duesseldorf flughafen", "dus", "flughafen", "airport"],
    },
  ],
  leipzig: [
    {
      label: "Markt Leipzig",
      lat: 51.340208,
      lng: 12.374497,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["markt", "marktplatz", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Leipzig Hauptbahnhof",
      lat: 51.345054,
      lng: 12.381643,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["leipzig hauptbahnhof", "leipzig hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Leipzig/Halle",
      lat: 51.423889,
      lng: 12.236389,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["leipzig halle flughafen", "flughafen", "airport", "lej"],
    },
  ],
  dresden: [
    {
      label: "Altmarkt Dresden",
      lat: 51.049198,
      lng: 13.737287,
      type: "address",
      subtitle: "Altstadt (Preset)",
      aliases: ["altmarkt", "altstadt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Dresden Hauptbahnhof",
      lat: 51.040375,
      lng: 13.732602,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["dresden hauptbahnhof", "dresden hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Dresden",
      lat: 51.132767,
      lng: 13.767161,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["dresden flughafen", "drs", "flughafen", "airport"],
    },
  ],
  hannover: [
    {
      label: "Kroepcke",
      lat: 52.37574,
      lng: 9.74177,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["kroepcke", "kropcke", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Hannover Hauptbahnhof",
      lat: 52.377893,
      lng: 9.741524,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["hannover hauptbahnhof", "hannover hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Hannover",
      lat: 52.460611,
      lng: 9.685,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["hannover flughafen", "flughafen", "airport", "haj"],
    },
  ],
  nuernberg: [
    {
      label: "Hauptmarkt Nuernberg",
      lat: 49.4532,
      lng: 11.0775,
      type: "address",
      subtitle: "Altstadt (Preset)",
      aliases: ["hauptmarkt", "altstadt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Nuernberg Hauptbahnhof",
      lat: 49.445571,
      lng: 11.081821,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["nuernberg hauptbahnhof", "nuernberg hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Nuernberg",
      lat: 49.4987,
      lng: 11.078056,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["nuernberg flughafen", "flughafen", "airport", "nue"],
    },
  ],
  bremen: [
    {
      label: "Marktplatz Bremen",
      lat: 53.075833,
      lng: 8.807222,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["marktplatz", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Bremen Hauptbahnhof",
      lat: 53.082662,
      lng: 8.813291,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["bremen hauptbahnhof", "bremen hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Bremen",
      lat: 53.0475,
      lng: 8.786667,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["bremen flughafen", "flughafen", "airport", "bre"],
    },
  ],
  stuttgart: [
    {
      label: "Schlossplatz",
      lat: 48.778471,
      lng: 9.180318,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["schlossplatz", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Stuttgart Hauptbahnhof",
      lat: 48.783943,
      lng: 9.18286,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["stuttgart hauptbahnhof", "stuttgart hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Stuttgart",
      lat: 48.689878,
      lng: 9.221964,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["stuttgart flughafen", "flughafen", "airport", "str"],
    },
  ],
  dortmund: [
    {
      label: "Alter Markt Dortmund",
      lat: 51.513611,
      lng: 7.466111,
      type: "address",
      subtitle: "Innenstadt (Preset)",
      aliases: ["alter markt", "innenstadt", "zentrum", "city", "hotel"],
    },
    {
      label: "Dortmund Hauptbahnhof",
      lat: 51.517625,
      lng: 7.459682,
      type: "station",
      subtitle: "Hauptbahnhof (Preset)",
      aliases: ["dortmund hauptbahnhof", "dortmund hbf", "hauptbahnhof", "hbf", "bahnhof", "station"],
    },
    {
      label: "Flughafen Dortmund",
      lat: 51.518314,
      lng: 7.612242,
      type: "airport",
      subtitle: "Flughafen (Preset)",
      aliases: ["dortmund flughafen", "flughafen", "airport", "dtm"],
    },
  ],
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Supabase env vars fehlen: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalize(text: string | null | undefined) {
  return (text ?? "").trim().toLowerCase();
}

function normalizeSearchKey(text: string | null | undefined) {
  return normalize(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapLocationType(rawType: string | null | undefined): SearchSuggestion["type"] {
  const value = normalize(rawType);

  if (
    value.includes("station") ||
    value.includes("bahnhof") ||
    value.includes("train") ||
    value.includes("subway")
  ) {
    return "station";
  }

  if (value.includes("hotel") || value.includes("hostel")) {
    return "hotel";
  }

  if (value.includes("airport") || value.includes("flug")) {
    return "airport";
  }

  return "address";
}

function typePreferenceScore(
  requestedType: string,
  suggestionType: SearchSuggestion["type"],
  rawType: string | null | undefined,
  label: string
) {
  const request = normalize(requestedType);
  const raw = normalize(rawType);
  const text = normalize(label);

  if (request === "station") {
    if (suggestionType === "station") return 60;
    if (raw.includes("station") || text.includes("hauptbahnhof")) return 50;
  }

  if (request === "hotel") {
    if (suggestionType === "hotel") return 60;
    if (raw.includes("hotel") || text.includes("hotel")) return 50;
  }

  if (request === "airport") {
    if (suggestionType === "airport") return 60;
    if (raw.includes("airport") || text.includes("flughafen")) return 50;
  }

  return 0;
}

function presetMatchScore(query: string, preset: CityStartPreset) {
  const normalizedQuery = normalizeSearchKey(query);
  const normalizedLabel = normalizeSearchKey(preset.label);
  const normalizedAliases = preset.aliases.map((alias) => normalizeSearchKey(alias));

  if (!normalizedQuery) {
    if (preset.type === "address") return 52;
    if (preset.type === "station") return 28;
    if (preset.type === "airport") return 18;
    return 12;
  }

  if (normalizedLabel === normalizedQuery || normalizedAliases.includes(normalizedQuery)) {
    return 170;
  }

  if (
    normalizedLabel.startsWith(normalizedQuery) ||
    normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))
  ) {
    return 120;
  }

  if (
    normalizedLabel.includes(normalizedQuery) ||
    normalizedAliases.some((alias) => alias.includes(normalizedQuery))
  ) {
    return 90;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) {
    return 0;
  }

  const matchedTokens = queryTokens.filter((token) =>
    [normalizedLabel, ...normalizedAliases].some((candidate) => candidate.includes(token))
  ).length;

  if (matchedTokens === queryTokens.length) {
    return 72;
  }

  if (matchedTokens > 0) {
    return 40;
  }

  return 0;
}

function buildCityPresetSuggestions(
  city: {
    slug: string | null;
    name: string | null;
    center_lat: number | null;
    center_lng: number | null;
  },
  query: string,
  requestedType: string
) {
  const cityName = String(city.name ?? "").trim();
  const citySlug = String(city.slug ?? "").trim();
  const normalizedQuery = normalizeSearchKey(query);
  const suggestions: Array<SearchSuggestion & { _score: number }> = [];
  const configuredPresets = CITY_PRESET_SUGGESTIONS[citySlug] ?? [];

  for (const preset of configuredPresets) {
    const score =
      presetMatchScore(query, preset) +
      typePreferenceScore(requestedType, preset.type, preset.subtitle, preset.label);

    const minScore = preset.type === "address" ? 28 : 34;
    if (!normalizedQuery || score >= minScore) {
      suggestions.push({
        label: preset.label,
        lat: preset.lat,
        lng: preset.lng,
        type: preset.type,
        source: "preset",
        citySlug,
        subtitle: preset.subtitle,
        _score: score,
      });
    }
  }

  if (Number.isFinite(Number(city.center_lat)) && Number.isFinite(Number(city.center_lng))) {
    let fallbackScore = normalizedQuery ? 24 : 46;
    const addressLikeTerms = [
      "zentrum",
      "mitte",
      "innenstadt",
      "city",
      "adresse",
      "strasse",
      "strasse",
      "hotel",
    ];
    if (addressLikeTerms.some((term) => normalizedQuery.includes(normalizeSearchKey(term)))) {
      fallbackScore += 24;
    }

    suggestions.push({
      label: `${cityName} Zentrum`,
      lat: Number(city.center_lat),
      lng: Number(city.center_lng),
      type: "address",
      source: "preset",
      citySlug,
      subtitle: "Stadtzentrum (Fallback)",
      _score: fallbackScore + typePreferenceScore(requestedType, "address", "address", cityName),
    });
  }

  return suggestions;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = normalize(url.searchParams.get("q"));
    const citySlug = canonicalCitySlug(normalize(url.searchParams.get("citySlug")) || null);
    const requestedType = normalize(url.searchParams.get("type")) || "address";
    const limit = Math.min(12, Math.max(5, Number(url.searchParams.get("limit") ?? "8") || 8));

    if (q.length < 2 && !citySlug) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = getSupabaseAdmin();
    let locationRows:
      | Array<{
          name: string | null;
          type: string | null;
          lat: number | null;
          lng: number | null;
          city_slug: string | null;
          category: string | null;
          manual_boost: number | null;
          quality_score: number | null;
          importance_score: number | null;
          popularity_score: number | null;
        }>
      | null = [];

    if (q.length >= 2) {
      let locationQuery = supabase
        .from("locations")
        .select(
          "name,type,lat,lng,city_slug,category,manual_boost,quality_score,importance_score,popularity_score"
        )
        .not("lat", "is", null)
        .not("lng", "is", null)
        .ilike("name", `%${q}%`)
        .limit(20);

      if (citySlug) {
        locationQuery = locationQuery.eq("city_slug", citySlug);
      }

      const { data, error: locationError } = await locationQuery;

      if (locationError) {
        throw new Error(`Geocode location search failed: ${locationError.message}`);
      }

      locationRows = data;
    }

    const cityQuery = citySlug
      ? supabase
          .from("cities")
          .select("slug,name,center_lat,center_lng,country_code")
          .not("center_lat", "is", null)
          .not("center_lng", "is", null)
          .eq("slug", citySlug)
          .eq("is_active", true)
          .limit(1)
      : supabase
          .from("cities")
          .select("slug,name,center_lat,center_lng,country_code")
          .not("center_lat", "is", null)
          .not("center_lng", "is", null)
          .ilike("name", `%${q}%`)
          .eq("is_active", true)
          .limit(5);

    const { data: cityRows, error: cityError } = await cityQuery;

    if (cityError) {
      throw new Error(`Geocode city search failed: ${cityError.message}`);
    }

    const locationSuggestions: Array<SearchSuggestion & { _score: number }> = (locationRows ?? [])
      .map((row) => {
        const label = String(row.name ?? "").trim();
        const rawType = String(row.type ?? "").trim();
        const suggestionType = mapLocationType(rawType);
        const labelNorm = normalize(label);

        let score = 0;
        if (labelNorm === q) score += 200;
        else if (labelNorm.startsWith(q)) score += 120;
        else if (labelNorm.includes(q)) score += 80;

        score += typePreferenceScore(requestedType, suggestionType, rawType, label);
        score += typeof row.manual_boost === "number" ? row.manual_boost : 0;
        score += typeof row.quality_score === "number" ? row.quality_score * 0.4 : 0;
        score += typeof row.importance_score === "number" ? row.importance_score * 0.3 : 0;
        score += typeof row.popularity_score === "number" ? row.popularity_score * 0.2 : 0;

        return {
          label,
          lat: Number(row.lat),
          lng: Number(row.lng),
          type: suggestionType,
          source: "location" as const,
          citySlug: (row.city_slug as string | null) ?? null,
          subtitle: rawType || null,
          _score: score,
        };
      })
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

    const presetSuggestions: Array<SearchSuggestion & { _score: number }> = citySlug
      ? buildCityPresetSuggestions(
          {
            slug: cityRows?.[0]?.slug ?? null,
            name: cityRows?.[0]?.name ?? null,
            center_lat: cityRows?.[0]?.center_lat ?? null,
            center_lng: cityRows?.[0]?.center_lng ?? null,
          },
          q,
          requestedType
        )
      : [];

    const citySuggestions: Array<SearchSuggestion & { _score: number }> = citySlug
      ? []
      : (cityRows ?? [])
          .map((row) => {
            const cityName = normalize(String(row.name));
            let score = 30;
            if (cityName === q) score += 120;
            else if (cityName.startsWith(q)) score += 80;
            else if (cityName.includes(q)) score += 50;

            return {
              label: `${row.name} Zentrum`,
              lat: Number(row.center_lat),
              lng: Number(row.center_lng),
              type: "address" as const,
              source: "city" as const,
              citySlug: (row.slug as string | null) ?? null,
              subtitle: "Stadtzentrum",
              _score: score,
            };
          })
          .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

    const merged = [...presetSuggestions, ...locationSuggestions, ...citySuggestions]
      .sort((a, b) => b._score - a._score)
      .filter((suggestion, index, arr) => {
        return (
          arr.findIndex(
            (other) =>
              normalize(other.label) === normalize(suggestion.label) &&
              Math.abs(other.lat - suggestion.lat) < 0.0001 &&
              Math.abs(other.lng - suggestion.lng) < 0.0001
          ) === index
        );
      })
      .slice(0, limit)
      .map(({ _score, ...suggestion }) => suggestion);

    return NextResponse.json({ suggestions: merged });
  } catch (error) {
    console.error("Geocode search failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Geocode search failed",
        suggestions: [],
      },
      { status: 500 }
    );
  }
}
