import { familyAgeBandLabel, familyAgeBandPlannerHint, norm } from "@/lib/planner";
import type {
  ExperienceMode,
  FamilyAgeBand,
  GroupMember,
  OccasionPhase,
  PlannedStop,
  PlannerEventRow,
  PlanMode,
  RouteProfile,
  ScoredLocation,
} from "@/lib/planner";
import type {
  CityRow,
  OccasionPhaseMeta,
  SavedPlanRow,
  PlannerSaveMode,
  StartPointSuggestion,
} from "./types";

/**
 * Returns the sensible default planMode for a given occasion.
 * Dates and friend outings are typically evening events;
 * family trips work best starting at midday;
 * tourism and parties are all-day or evening by default.
 */
export function defaultPlanModeForOccasion(occasion: string): PlanMode {
  if (occasion === "date" || occasion === "friends") return "evening";
  if (occasion === "family") return "midday";
  if (occasion === "party") return "evening";
  return "fullday"; // tourism, solo, etc.
}

export const EMPTY_PLANNER_RESULTS: ScoredLocation[] = [];
export const EMPTY_PLANNER_EVENT_ROWS: PlannerEventRow[] = [];
export const EMPTY_PLANNED_STOPS: PlannedStop[] = [];

const START_POINT_CITY_FALLBACK_LABELS: Record<string, string> = {
  "berlin-berlin": "Alexanderplatz",
  hamburg: "Binnenalster",
  muenchen: "Marienplatz",
  koeln: "Koeln Altstadt / Dom",
  "frankfurt-am-main": "Roemerberg",
  duesseldorf: "Duesseldorf Altstadt",
  leipzig: "Markt Leipzig",
  dresden: "Altmarkt Dresden",
  hannover: "Kroepcke",
  nuernberg: "Hauptmarkt Nuernberg",
  bremen: "Marktplatz Bremen",
  stuttgart: "Schlossplatz",
  dortmund: "Alter Markt Dortmund",
  "freiburg-im-breisgau": "Muensterplatz Freiburg",
  luebeck: "Markt Luebeck",
  erfurt: "Domplatz Erfurt",
  magdeburg: "Alter Markt Magdeburg",
  moenchengladbach: "Alter Markt Moenchengladbach",
  gelsenkirchen: "Heinrich-Koenig-Platz",
};

export function cityStartFallbackLabel(city: CityRow | null | undefined) {
  if (!city) return "Stadtzentrum";
  return START_POINT_CITY_FALLBACK_LABELS[city.slug] ?? `${city.name} Zentrum`;
}

export function startPointSuggestionTypeLabel(type: StartPointSuggestion["type"]) {
  if (type === "station") return "Bahnhof";
  if (type === "airport") return "Flughafen";
  if (type === "hotel") return "Hotel";
  if (type === "other") return "Ort";
  return "Startpunkt";
}

export function startPointSuggestionSourceLabel(source: StartPointSuggestion["source"]) {
  if (source === "preset") return "Empfohlen";
  if (source === "city") return "Stadt";
  return "Treffer";
}

export function countryLabel(code: string | null | undefined) {
  if (!code) return "Unbekannt";
  const upper = code.toUpperCase();
  if (upper === "DE") return "Deutschland";
  if (upper === "AT") return "Österreich";
  if (upper === "CH") return "Schweiz";
  if (upper === "FR") return "Frankreich";
  if (upper === "IT") return "Italien";
  if (upper === "ES") return "Spanien";
  if (upper === "NL") return "Niederlande";
  if (upper === "BE") return "Belgien";
  if (upper === "GB" || upper === "UK") return "Vereinigtes Königreich";
  if (upper === "US") return "USA";
  return upper;
}

export function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function eventStrictnessForExperienceMode(mode: ExperienceMode) {
  if (mode === "show") return "required" as const;
  if (mode === "event_visit" || mode === "market_festival") return "hybrid" as const;
  return "off" as const;
}

export function experienceModeLabel(mode: ExperienceMode, occasion: string) {
  if (mode === "classic") return "Klassisch";
  if (mode === "show") return occasion === "date" ? "Show-Date" : "Show & Auffuehrung";
  if (mode === "event_visit") {
    if (occasion === "date") return "Erlebnisdate";
    if (occasion === "family") return "Familien-Erlebnis";
    if (occasion === "friends") return "Eventbesuch";
    return "Erlebnis mit Event";
  }
  return "Markt & Festival";
}

export function experienceModeHint(mode: ExperienceMode, occasion: string) {
  if (mode === "classic") {
    return "Keine aktive Event-Suche. Der Plan bleibt bei Orten, Flow und Vorlieben.";
  }
  if (mode === "show") {
    return occasion === "date"
      ? "Sucht gezielt nach Konzert, Theater oder Show als Hauptmoment für euer Date."
      : "Sucht gezielt nach Show-, Konzert- oder Theater-Highlights mit fester Uhrzeit.";
  }
  if (mode === "event_visit") {
    return "Nutzt passende Events als mögliches Highlight, ohne jede Planung hart daran aufzuhängen.";
  }
  return "Bevorzugt flexible Event-Highlights wie Märkte, Festivals, Kirmes oder Food-Events.";
}

export function experienceOptionsForOccasion(
  occasion: string
): Array<{ value: ExperienceMode; label: string }> {
  const classic = { value: "classic" as const, label: "Klassisch" };

  if (occasion === "date") {
    return [
      classic,
      { value: "show", label: "Show-Date" },
      { value: "event_visit", label: "Erlebnisdate" },
      { value: "market_festival", label: "Markt & Festival" },
    ];
  }

  if (occasion === "friends") {
    return [
      classic,
      { value: "event_visit", label: "Eventbesuch" },
      { value: "show", label: "Show & Konzert" },
      { value: "market_festival", label: "Festival & Markt" },
    ];
  }

  if (occasion === "family") {
    return [
      classic,
      { value: "event_visit", label: "Familien-Erlebnis" },
      { value: "market_festival", label: "Markt & Kirmes" },
    ];
  }

  if (occasion === "tourism") {
    return [
      classic,
      { value: "event_visit", label: "Mit Event-Highlight" },
      { value: "market_festival", label: "Markt & Festival" },
      { value: "show", label: "Show am Abend" },
    ];
  }

  if (occasion === "party") {
    return [
      classic,
      { value: "show", label: "Live-Show + Nightlife" },
      { value: "event_visit", label: "Eventbesuch" },
      { value: "market_festival", label: "Festival Start" },
    ];
  }

  return [classic];
}

export function familyAgeBandSummary(ageBand: FamilyAgeBand | null | undefined) {
  return familyAgeBandLabel(ageBand);
}

export function familyAgeBandHint(ageBand: FamilyAgeBand | null | undefined) {
  return familyAgeBandPlannerHint(ageBand);
}

export function savedPlanFamilyKey(plan: SavedPlanRow) {
  const sourceId =
    typeof plan.filters?.editSourcePlanId === "string" && plan.filters.editSourcePlanId.trim()
      ? plan.filters.editSourcePlanId.trim()
      : null;
  return sourceId || plan.id;
}

export function savedPlanRoleLabel(plan: SavedPlanRow) {
  const mode =
    typeof plan.filters?.editSaveMode === "string"
      ? (plan.filters.editSaveMode as PlannerSaveMode)
      : null;

  if (plan.filters?.finalGroupPlan) return "Finale Version";
  if (mode === "new_variant") return "Neue Gruppenvariante";
  if (mode === "new_version") return "Neuer Stand";
  if (plan.filters?.editSourcePlanId) return "Abgeleitet";
  return "Original";
}

export function compareSavedPlans(basePlan: SavedPlanRow | null, nextPlan: SavedPlanRow | null) {
  if (!basePlan || !nextPlan) return [] as string[];

  const changes: string[] = [];

  if ((basePlan.title || "") !== (nextPlan.title || "")) {
    changes.push("Titel wurde angepasst");
  }
  if ((basePlan.filters?.planMode || null) !== (nextPlan.filters?.planMode || null)) {
    changes.push(`Modus: ${basePlan.filters?.planMode || "-"} → ${nextPlan.filters?.planMode || "-"}`);
  }
  if ((basePlan.filters?.stopsCount || null) !== (nextPlan.filters?.stopsCount || null)) {
    changes.push(`Stops: ${basePlan.filters?.stopsCount || "-"} → ${nextPlan.filters?.stopsCount || "-"}`);
  }
  if ((basePlan.radius_km || null) !== (nextPlan.radius_km || null)) {
    changes.push(`Radius: ${basePlan.radius_km} km → ${nextPlan.radius_km} km`);
  }
  if ((basePlan.filters?.pinnedVariantLabel || null) !== (nextPlan.filters?.pinnedVariantLabel || null)) {
    changes.push(
      `Gemeinsame Wahl: ${basePlan.filters?.pinnedVariantLabel || "keine"} → ${nextPlan.filters?.pinnedVariantLabel || "keine"}`
    );
  }
  if ((basePlan.filters?.finalGroupStatusLabel || null) !== (nextPlan.filters?.finalGroupStatusLabel || null)) {
    changes.push(
      `Status: ${basePlan.filters?.finalGroupStatusLabel || "offen"} → ${nextPlan.filters?.finalGroupStatusLabel || "offen"}`
    );
  }

  return changes;
}

export function deriveConfirmationMoment(count: number, expectedCount?: number | null) {
  const total = typeof expectedCount === "number" && expectedCount > 0 ? expectedCount : null;
  const majority = total ? Math.max(2, Math.ceil(total / 2)) : null;

  if (total && count >= total) {
    return {
      label: "Tag ist abgestimmt",
      secondaryLabel: "Alle haben bestätigt",
      tone: "emerald",
    } as const;
  }
  if (majority && count >= majority) {
    return {
      label: "Gruppenwahl bestätigt",
      secondaryLabel: "Mehrheit erreicht",
      tone: "emerald",
    } as const;
  }
  if (majority && majority - count === 1) {
    return {
      label: "Fast bestätigt",
      secondaryLabel: "Noch 1 Stimme",
      tone: "amber",
    } as const;
  }
  if (count > 0) {
    return {
      label: "Erste Zustimmung da",
      secondaryLabel: "Noch offen",
      tone: "sky",
    } as const;
  }
  return null;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function parseNullableNumber(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function formatPlannerTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function providerLabel(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "ticketmaster") return "Ticketmaster";
  if (normalized === "openagenda") return "OpenAgenda";
  if (normalized === "visitberlin") return "visitBerlin";
  if (normalized === "berlin_de") return "Berlin.de";
  if (normalized === "hamburg_tourism") return "Hamburg Tourismus";
  if (normalized === "hamburg_infomax") return "Hamburg Kulturkalender";
  if (normalized === "muenchen_de") return "muenchen.de";
  if (normalized === "frankfurt_tourism") return "visitFrankfurt";
  if (normalized === "koeln_tourism") return "KölnTourismus";
  if (normalized === "duesseldorf_tourism") return "Visit Düsseldorf";
  if (normalized === "leipzig_travel") return "Leipzig Travel";
  if (normalized === "dresden_tourism") return "Dresden";
  if (normalized === "hannover_tourism") return "Visit Hannover";
  if (normalized === "nuernberg_tourism") return "Nürnberg Tourismus";
  if (normalized === "bremen_tourism") return "Bremen";
  if (normalized === "stuttgart_tourism") return "Stuttgart";
  if (normalized === "dortmund_tourism") return "Dortmund";
  if (normalized === "bonn_city") return "Bonn";
  if (normalized === "visit_essen") return "Visit Essen";
  if (normalized === "karlsruhe_tourism") return "Karlsruhe";
  if (normalized === "muenster_tourism") return "Muenster";
  if (normalized === "aachen_city") return "Aachen";
  if (normalized === "augsburg_city") return "Augsburg";
  if (normalized === "kiel_sailing_city") return "Kiel Sailing City";
  if (normalized === "bielefeld_jetzt") return "Bielefeld.JETZT";
  if (normalized === "braunschweig_region") return "Braunschweig";
  if (normalized === "bochum_tourism") return "Bochum";
  if (normalized === "duisburg_live") return "Duisburg Live";
  if (normalized === "wuppertal_live") return "Wuppertal Live";
  if (normalized === "freiburg_eventportal") return "Freiburg Eventportal";
  if (normalized === "luebeck_tourism") return "Luebeck Tourismus";
  if (normalized === "erfurt_tourism") return "Erfurt Tourismus";
  if (normalized === "magdeburg_city") return "Magdeburg";
  if (normalized === "moenchengladbach_city") return "Moenchengladbach";
  if (normalized === "gelsenkirchen_city") return "Gelsenkirchen";
  if (!normalized) return "Unbekannt";
  return value ?? "Unbekannt";
}

export function normalizeDebugToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function eventDebugSignature(event: PlannerEventRow) {
  const dateKey = event.start_at ? event.start_at.slice(0, 10) : "no-date";
  const titleTokens = normalizeDebugToken(event.title)
    .split(" ")
    .filter((token) => token.length > 2)
    .slice(0, 6)
    .join(" ");
  return `${event.category}|${dateKey}|${titleTokens}`;
}

export function eventDedupeFlags(event: PlannerEventRow) {
  const subtypes = Array.isArray(event.subtypes) ? event.subtypes.map(String) : [];
  return {
    isPrimary: subtypes.includes("dedupe_primary"),
    isShadow: subtypes.includes("dedupe_shadow") || event.status === "draft",
  };
}

export function readEventSourceRefs(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const refs = value as Record<string, unknown>;
  return {
    source: typeof refs.source === "string" ? refs.source : null,
    ticketUrl: typeof refs.ticketUrl === "string" ? refs.ticketUrl : null,
    sourceUrl: typeof refs.sourceUrl === "string" ? refs.sourceUrl : null,
    startsAt: typeof refs.startsAt === "string" ? refs.startsAt : null,
    endsAt: typeof refs.endsAt === "string" ? refs.endsAt : null,
    doorsAt: typeof refs.doorsAt === "string" ? refs.doorsAt : null,
    venueName: typeof refs.venueName === "string" ? refs.venueName : null,
  };
}

export function eventMetaBadges(stop: PlannedStop) {
  if (!stop.item || stop.item.source_primary !== "planner_event") return [];

  const badges: string[] = [];
  const subtypes = Array.isArray(stop.item.subtypes) ? stop.item.subtypes.map(String) : [];

  if (stop.item.family_friendly) badges.push("familienfreundlich");
  if (subtypes.includes("ticketed_event")) badges.push("Ticket erforderlich");
  if (subtypes.includes("seasonal_event")) badges.push("saisonal");
  if (subtypes.includes("market_event")) badges.push("Markt");
  if (subtypes.includes("festival_event")) badges.push("Festival");
  if (subtypes.includes("street_food")) badges.push("Food");

  return badges;
}

export function eventTravelPriorityNote(
  stop: PlannedStop,
  index: number,
  routeProfile: RouteProfile
) {
  if (!stop.item || stop.item.source_primary !== "planner_event") return null;

  const selectedFrom = stop.debug?.selectedFrom ?? null;
  const isForcedEvent = selectedFrom === "forced_event";
  const isFootRoute = routeProfile === "foot";
  const travelMin = stop.travelMinFromPrev;

  if (isForcedEvent && index === 0 && isFootRoute) {
    return "Dieses Event wurde als Tagesziel priorisiert. Für den Start ist eine längere Anfahrt mit ÖPNV/Auto-Logik eingerechnet.";
  }

  if (typeof travelMin === "number" && travelMin >= 35 && isFootRoute) {
    return "Längerer Anfahrtsweg für dieses Event eingeplant. Der Planner behandelt es bewusst als Tagesziel statt als reinen Fußweg-Cluster.";
  }

  if (isForcedEvent && index === 0) {
    return "Dieses Event wurde als Tagesziel priorisiert und bewusst als erster Hauptstop gesetzt.";
  }

  return null;
}

export function eventTravelPriorityNoteForSavedSlot(
  slot: {
    index?: number | null;
    label?: string | null;
    hint?: string | null;
    durationMin?: number | null;
    travelMinFromPrev?: number | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    timingLock?: "none" | "event" | null;
    reasons?: string[];
    location?: any;
  },
  index: number,
  routeProfile: RouteProfile
) {
  return eventTravelPriorityNote(
    {
      index: slot.index ?? index + 1,
      label: slot.label ?? `Stop ${index + 1}`,
      hint: slot.hint ?? "",
      item: (slot.location ?? null) as PlannedStop["item"],
      durationMin: slot.durationMin ?? null,
      travelMinFromPrev: slot.travelMinFromPrev ?? null,
      scheduledStartAt: slot.scheduledStartAt ?? null,
      scheduledEndAt: slot.scheduledEndAt ?? null,
      timingLock: slot.timingLock ?? null,
      reasons: slot.reasons ?? [],
      debug: null,
    },
    index,
    routeProfile
  );
}

export function routeProfileLabel(profile: RouteProfile) {
  if (profile === "foot") return "zu Fuß";
  if (profile === "public_transit") return "ÖPNV";
  return "Auto";
}

export function routeProfileHint(profile: RouteProfile) {
  if (profile === "foot") {
    return "Bevorzugt kompakte Cluster mit kurzen Wegen.";
  }
  if (profile === "public_transit") {
    return "Erlaubt realistischere Sprünge in der Stadt, ohne komplett autozentriert zu planen.";
  }
  return "Erlaubt größere Distanzen und lockere Stadtwechsel zwischen Stops.";
}

export function budgetLabel(value: string) {
  if (value === "low") return "Günstig";
  if (value === "high") return "Premium";
  if (value === "free") return "Kostenlos";
  return "Mittel";
}

export function occasionLabel(value: string) {
  if (value === "friends") return "Freunde";
  if (value === "family") return "Familie";
  if (value === "party") return "Party";
  if (value === "tourism") return "Tourismus";
  return "Date";
}

export function compactPartyLabel(
  occasion: string,
  groupEnabled: boolean,
  groupMembers: GroupMember[]
) {
  const participantCount = groupEnabled ? groupMembers.length + 1 : 1;
  if (occasion === "family") return `${participantCount} Personen`;
  if (participantCount === 1) return "1 Erwachsener";
  return `${participantCount} Erwachsene`;
}

export function plannerDateLabel(value: string) {
  if (!value) return "Ohne Datum";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function buildGroupPlanningSignals(
  ownerInterests: string[],
  members: GroupMember[],
  enabled: boolean
) {
  const participants = [
    ...(ownerInterests.length > 0 ? [{ name: "Du", interests: ownerInterests }] : []),
    ...(enabled ? members.map((member) => ({ name: member.name, interests: member.interests })) : []),
  ].filter((entry) => entry.interests.length > 0);

  if (participants.length === 0) {
    return {
      participantCount: enabled ? members.length + 1 : 1,
      activeParticipantCount: 0,
      sharedAcrossAll: [] as string[],
      overlapping: [] as string[],
      uniqueSignals: [] as Array<{ name: string; interests: string[] }>,
    };
  }

  const counts = new Map<string, number>();
  for (const participant of participants) {
    const unique = Array.from(new Set(participant.interests.map(norm).filter(Boolean)));
    for (const interest of unique) {
      counts.set(interest, (counts.get(interest) ?? 0) + 1);
    }
  }

  const sharedAcrossAll = Array.from(counts.entries())
    .filter(([, count]) => count === participants.length)
    .map(([interest]) => interest)
    .slice(0, 6);

  const overlapping = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([interest]) => interest)
    .slice(0, 8);

  const uniqueSignals = participants
    .map((participant) => ({
      name: participant.name,
      interests: Array.from(new Set(participant.interests.map(norm).filter(Boolean))).filter(
        (interest) => (counts.get(interest) ?? 0) === 1
      ),
    }))
    .filter((participant) => participant.interests.length > 0)
    .slice(0, 4);

  return {
    participantCount: enabled ? members.length + 1 : 1,
    activeParticipantCount: participants.length,
    sharedAcrossAll,
    overlapping,
    uniqueSignals,
  };
}

export function generateShareToken(len = 18) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function inferRouteThemeFromInterests(interests: string[]) {
  const values = interests.map((value) => value.toLowerCase());
  if (
    values.some((value) =>
      ["museum", "landmark", "viewpoint", "old town", "theater", "culture"].includes(value)
    )
  ) {
    return "culture" as const;
  }
  if (values.some((value) => ["park", "walk", "view", "rooftop", "natur", "river"].includes(value))) {
    return "outdoor" as const;
  }
  if (
    values.some((value) =>
      ["wine", "cocktails", "beer", "bar", "techno", "club", "late food", "jazz"].includes(value)
    )
  ) {
    return "nightlife" as const;
  }
  if (
    values.some((value) =>
      [
        "italien",
        "sushi",
        "vegan",
        "steak",
        "burger",
        "streetfood",
        "local food",
        "dinner",
        "coffee",
        "cafe",
      ].includes(value)
    )
  ) {
    return "food" as const;
  }
  return "mixed" as const;
}

export function formatSupabaseError(error: unknown) {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  const parts = [
    candidate.code,
    candidate.message,
    candidate.details,
    candidate.hint,
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);

  if (parts.length) return parts.join(" | ");

  try {
    return JSON.stringify(error);
  } catch {
    return "Unbekannter Fehler";
  }
}

export function buildPlanGroupChatSystemMessage(plan: SavedPlanRow) {
  const lines = [
    `Gruppenchat für "${plan.filters?.finalVariantLabel || plan.title || plan.filters?.pinnedVariantLabel || "diesen Plan"}" eröffnet.`,
  ];

  if (plan.filters?.pinnedVariantLabel) {
    lines.push(`Unsere Wahl: ${plan.filters.pinnedVariantLabel}`);
  }

  if (plan.filters?.finalGroupStatusLabel) {
    lines.push(`Status: ${plan.filters.finalGroupStatusLabel}`);
  } else if (plan.filters?.groupChoiceLabel) {
    lines.push(`Status: ${plan.filters.groupChoiceLabel}`);
  }

  return lines.join("\n");
}

export function buildFinalPlanSavedSystemMessage(
  plan: SavedPlanRow,
  choiceLabel: string | null,
  voteCount: number,
  totalParticipants: number
) {
  const lines = [
    `${plan.filters?.finalGroupStatusLabel || plan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan"} gespeichert.`,
  ];

  if (choiceLabel) {
    lines.push(`Gemeinsame Wahl: ${choiceLabel}`);
  }

  if (voteCount > 0 && totalParticipants > 0) {
    lines.push(`Lokale Zustimmung: ${voteCount} von ${totalParticipants}`);
  }

  return lines.join("\n");
}

export function buildGoogleMapsDirUrl(
  points: Array<{ lat: number; lng: number }>,
  mode: RouteProfile
) {
  if (points.length < 2) return null;

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;

  const waypoints =
    points.length > 2
      ? points
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join("|")
      : "";

  const travelmode =
    mode === "foot" ? "walking" : mode === "public_transit" ? "transit" : "driving";

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", travelmode);
  if (waypoints) url.searchParams.set("waypoints", waypoints);

  return url.toString();
}

export function phaseMeta(
  phase: OccasionPhase | null | undefined,
  occasion: string
): OccasionPhaseMeta | null {
  if (phase === "warmup") return { label: "Ankommen", short: "Locker starten" };
  if (phase === "shared_experience") return { label: "Gemeinsames Erlebnis", short: "Dynamik aufbauen" };
  if (phase === "deepen") return { label: "Vertiefung", short: "Mehr Gespräch und Nähe" };
  if (phase === "highlight") return { label: "Highlight", short: "Besonderer Moment" };
  if (phase === "close") return { label: "Ausklang", short: "Positiv enden" };
  if (occasion === "family" && phase === "arrival") return { label: "Ankommen", short: "Stressfrei starten" };
  if (occasion === "family" && phase === "main_activity") return { label: "Hauptaktivität", short: "Highlight früh legen" };
  if (occasion === "family" && phase === "pause") return { label: "Pause", short: "Energie resetten" };
  if (occasion === "family" && phase === "light_activity") return { label: "Leichte Aktivität", short: "Flexibel weiterführen" };
  if (occasion === "family" && phase === "wind_down") return { label: "Ausklang", short: "Ruhig beenden" };
  if (occasion === "friends" && phase === "social_warmup") return { label: "Warm-up", short: "Locker ankommen" };
  if (occasion === "friends" && phase === "social_activity") return { label: "Erlebnis", short: "Gruppendynamik aufbauen" };
  if (occasion === "friends" && phase === "social_meal") return { label: "Essen", short: "Sozialer Mittelpunkt" };
  if (occasion === "friends" && phase === "social_flex") return { label: "Flex", short: "Spontan weiterfuehren" };
  if (occasion === "friends" && phase === "social_peak") return { label: "Peak", short: "Gemeinsamer Hoehepunkt" };
  if (occasion === "tourism" && phase === "tour_start") return { label: "Start", short: "Zentral beginnen" };
  if (occasion === "tourism" && phase === "tour_highlight") return { label: "Highlight", short: "Must-see zuerst" };
  if (occasion === "tourism" && phase === "tour_culture") return { label: "Kultur", short: "Historisch vertiefen" };
  if (occasion === "tourism" && phase === "tour_lunch") return { label: "Lunch", short: "Pause im Cluster" };
  if (occasion === "tourism" && phase === "tour_relaxed") return { label: "Relaxed", short: "Nachmittags leichter" };
  if (occasion === "tourism" && phase === "tour_optional") return { label: "Optional", short: "Flexibel ergänzen" };
  if (occasion === "tourism" && phase === "tour_dinner") return { label: "Dinner", short: "Atmosphaerisch enden" };
  if (occasion === "party" && phase === "party_warmup") return { label: "Warm-up", short: "Locker starten" };
  if (occasion === "party" && phase === "party_social") return { label: "Pre-Drinks", short: "Stimmung aufbauen" };
  if (occasion === "party" && phase === "party_peak") return { label: "Peak", short: "Haupt-Club / Event" };
  if (occasion === "party" && phase === "party_after") return { label: "After", short: "Nicht abrupt zerfallen" };
  if (occasion === "party" && phase === "party_food") return { label: "Late Food", short: "Spaeter Snack" };
  return null;
}
