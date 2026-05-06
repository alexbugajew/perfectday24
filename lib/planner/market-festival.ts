const MARKET_FESTIVAL_INTENT_RE =
  /\b(?:wochenmarkt|flohmarkt|street food|food market|farmers market|night market|bauernmarkt|night bazaar|trempelmarkt|kreativmarkt|designmarkt|kunstmarkt|market|markt|festival|japan day|fruehlingsfest|frühlingsfest|maifest|kirmes|funfair|fairground|messe|trade fair|art fair|design fair|book fair|bazaar|expo)\b/i;
const MARKET_FESTIVAL_FAIR_INTENT_RE =
  /\b(?:messe|trade fair|art fair|design fair|book fair|funfair|fairground|kirmes|bazaar|expo)\b/i;
const MARKET_FESTIVAL_SEASONAL_EVENT_RE =
  /\b(?:fruehlingsfest|frühlingsfest|maifest|sommerfest|wintermarkt|weihnachtsmarkt|christkindlmarkt|adventsmarkt|ostermarkt|herbstfest|open air season|season opening)\b/i;
const MARKET_FESTIVAL_EXHIBITION_RE =
  /\b(?:museum|exhibition|ausstellung|gallery|galerie|sammlung|retrospective|vernissage|painting exhibition)\b/i;
const MARKET_FESTIVAL_NON_MARKET_ACTIVITY_RE =
  /\b(?:course|kurs|workshop|seminar|class|training|lecture|lesung|vortrag|guided tour|fuehrung|führung|tour|walk|hike|cruise|boat trip|barista)\b/i;
const MARKET_FESTIVAL_COMMUNITY_ACTIVITY_RE =
  /\b(?:sprechstunde|beratung|austausch|arbeitsmarktintegration|capoeira|sport|bewegung|infostand|information|dialog|stammtisch|selbsthilfe|expert(?:en)? geben auskunft)\b/i;
const MARKET_FESTIVAL_CONSULTATION_RE =
  /\b(?:sprechstunde|beratung|arbeitsmarktintegration|austausch|expert(?:en)? geben auskunft)\b/i;
const MARKET_FESTIVAL_STAGE_EVENT_RE =
  /\b(?:impro|improtheater|jazzsession|session|concert|konzert|show|musical|kabarett|comedy|theater|theatre|oper|opera|kino|film|screening|performance)\b/i;
const MARKET_FESTIVAL_ADDRESS_NOISE_RE =
  /\b(?:\d{1,4}[a-z]?\b.*\b\d{4,5}\b|strasse|straße|platz|allee|gasse|ufer|markt\s+\d+)\b/i;

type MarketFestivalInput = {
  text: string | null | undefined;
  subtypes?: readonly string[] | null | undefined;
  category?: string | null | undefined;
};

function scalarText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLowerCase() : "";
}

function arrayText(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => scalarText(entry))
        .filter(Boolean)
    : [];
}

function normalizedSignalText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function normalizedSubtypes(subtypes: readonly string[] | null | undefined) {
  return new Set((subtypes ?? []).map((value) => value.toLowerCase()));
}

function hasSubtype(subtypes: Set<string>, ...values: string[]) {
  return values.some((value) => subtypes.has(value));
}

export function marketFestivalSpecificityScore(input: MarketFestivalInput) {
  const text = normalizedSignalText((input.text ?? "").toLowerCase());
  const subtypes = normalizedSubtypes(input.subtypes);
  const category = (input.category ?? "").toLowerCase();

  const strongMarketFestivalSubtype = hasSubtype(
    subtypes,
    "market",
    "festival",
    "weekly_market",
    "market_event",
    "festival_event",
    "seasonal_event",
    "fairground"
  );
  const fairLike = category === "fair" || hasSubtype(subtypes, "fairground");
  const marketFestivalIntent = MARKET_FESTIVAL_INTENT_RE.test(text);
  const fairIntent = MARKET_FESTIVAL_FAIR_INTENT_RE.test(text);
  const seasonalIntent = MARKET_FESTIVAL_SEASONAL_EVENT_RE.test(text);
  const exhibitionLike = MARKET_FESTIVAL_EXHIBITION_RE.test(text);
  const guidedTourLike =
    hasSubtype(subtypes, "guided_tour") || MARKET_FESTIVAL_NON_MARKET_ACTIVITY_RE.test(text);
  const communityActivityLike =
    hasSubtype(subtypes, "talk", "lecture", "workshop", "guided_tour") ||
    MARKET_FESTIVAL_COMMUNITY_ACTIVITY_RE.test(text);
  const explicitFestivalLike = category === "festival" || hasSubtype(subtypes, "festival", "festival_event");
  const consultationLike = hasSubtype(subtypes, "talk", "lecture") || MARKET_FESTIVAL_CONSULTATION_RE.test(text);
  const stageLike =
    hasSubtype(subtypes, "show", "concert", "theater", "performing_arts", "show_event", "live_music") ||
    MARKET_FESTIVAL_STAGE_EVENT_RE.test(text);
  const addressNoise = MARKET_FESTIVAL_ADDRESS_NOISE_RE.test(text);

  let score = 0;

  if (category === "market" || hasSubtype(subtypes, "market")) score += 120;
  if (category === "festival" || hasSubtype(subtypes, "festival")) score += 110;
  if (category === "food_event" || hasSubtype(subtypes, "food_event")) score += 18;
  if (category === "seasonal" || hasSubtype(subtypes, "seasonal_event")) {
    score += seasonalIntent ? 70 : -60;
  }
  if (hasSubtype(subtypes, "weekly_market")) score += 80;
  if (hasSubtype(subtypes, "market_event")) score += 70;
  if (hasSubtype(subtypes, "festival_event")) score += 60;

  if (fairLike) {
    score += fairIntent ? 45 : -45;
  }

  if (marketFestivalIntent) score += 55;
  if (fairIntent) score += 35;

  if (guidedTourLike && !marketFestivalIntent && !fairIntent && !seasonalIntent) {
    score -= strongMarketFestivalSubtype ? 165 : 220;
  }

  if (communityActivityLike && !fairIntent && !seasonalIntent) {
    if (marketFestivalIntent && explicitFestivalLike) {
      score -= 40;
    } else {
      score -= marketFestivalIntent ? 120 : strongMarketFestivalSubtype ? 220 : 260;
    }
  }

  if (consultationLike) {
    score -= strongMarketFestivalSubtype ? 320 : 360;
  }

  if (stageLike && !marketFestivalIntent && !fairIntent && !seasonalIntent) {
    score -= strongMarketFestivalSubtype ? 120 : 190;
  }

  if (exhibitionLike && !marketFestivalIntent && !fairIntent && !strongMarketFestivalSubtype) {
    score -= 200;
  } else if (exhibitionLike) {
    score -= 70;
  }

  if (
    MARKET_FESTIVAL_NON_MARKET_ACTIVITY_RE.test(text) &&
    !marketFestivalIntent &&
    !fairIntent &&
    !strongMarketFestivalSubtype
  ) {
    score -= 140;
  }

  if (addressNoise && !marketFestivalIntent && !fairIntent && !seasonalIntent) {
    score -= 60;
  }

  return score;
}

export function isEligibleMarketFestival(input: MarketFestivalInput) {
  return marketFestivalSpecificityScore(input) >= 40;
}

export function buildMarketFestivalIntentText(source: {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  summary?: unknown;
  quality_notes?: unknown;
  venue_name?: unknown;
  venue_address?: unknown;
  tags?: unknown;
}) {
  const filteredTags = arrayText(source.tags).filter(
    (tag) => !MARKET_FESTIVAL_ADDRESS_NOISE_RE.test(normalizedSignalText(tag))
  );
  return Array.from(
    new Set(
      [
        scalarText(source.name),
        scalarText(source.title),
        scalarText(source.description),
        scalarText(source.summary),
        scalarText(source.quality_notes),
        scalarText(source.venue_name),
        ...filteredTags,
      ].filter(Boolean)
    )
  ).join(" ");
}
