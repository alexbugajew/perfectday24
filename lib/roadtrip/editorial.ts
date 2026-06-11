import type { RoadtripRoute, RoadtripRouteStop } from "@/lib/roadtrip/types";
import { getRoadtripCoverArt } from "@/lib/roadtrip/cover-art";

export type RoadtripEditorialSpotlight = {
  city: string;
  title: string;
  copy: string;
  nights: number;
};

export type RoadtripEditorial = {
  coverImageUrl: string | null;
  coverImageAlt: string;
  teaser: string;
  intro: string;
  highlights: string[];
  stopSpotlights: RoadtripEditorialSpotlight[];
};

const COVER_IMAGE_BY_SLUG: Record<string, string> = {
  "hanse-sea-city-loop": "/roadtrip/route-mosel.png",
  "east-germany-design-history-loop": "/roadtrip/route-romantische-strasse.png",
  "ruhr-industriekultur-after-dark": "/roadtrip/route-romantische-strasse.png",
  "black-forest-spa-city-loop": "/roadtrip/route-schwarzwald.png",
  "franconia-bavaria-slow-drive": "/roadtrip/route-romantische-strasse.png",
  "rhine-main-wine-city-loop": "/roadtrip/route-mosel.png",
  "alpine-lakes-borderline": "/roadtrip/route-alpen.png",
  "slovenia-lakes-to-sea": "/roadtrip/route-alpen.png",
  "istria-sunset-loop": "/roadtrip/route-mosel.png",
  "highlands-coastline-run": "/roadtrip/route-schwarzwald.png",
  "norway-fjords-icons": "/roadtrip/route-alpen.png",
  "baltic-islands-family-loop": "/roadtrip/route-alpen.png",
  "harz-castles-steam-loop": "/roadtrip/route-schwarzwald.png",
  "moselle-wine-castle-curve": "/roadtrip/route-mosel.png",
  "german-wine-route-weekender": "/roadtrip/route-mosel.png",
  "bavarian-castles-alpine-finish": "/roadtrip/route-alpen.png",
  "lake-constance-grand-loop": "/roadtrip/route-alpen.png",
  "salzkammergut-lakes-escape": "/roadtrip/route-alpen.png",
  "dolomites-great-passes": "/roadtrip/route-alpen.png",
  "alsace-black-forest-borderline": "/roadtrip/route-romantische-strasse.png",
  "andalusia-white-villages-run": "/roadtrip/route-romantische-strasse.png",
};

function joinNatural(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} und ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} und ${labels[labels.length - 1]}`;
}

function trimSentence(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.replace(/\s+/g, " ").replace(/\.$/, "");
}

function buildFallbackCoverImage(route: RoadtripRoute): string {
  if (route.tags.includes("nature") || route.tags.includes("adventure")) {
    return "/roadtrip/route-alpen.png";
  }
  if (route.tags.includes("food") || route.occasion === "date") {
    return "/roadtrip/route-mosel.png";
  }
  if (route.tags.includes("culture") || route.occasion === "tourism") {
    return "/roadtrip/route-romantische-strasse.png";
  }
  return "/roadtrip/route-schwarzwald.png";
}

function buildThemeSentence(route: RoadtripRoute): string {
  if (route.tags.includes("family")) {
    return "Unterwegs bleibt genug Luft fuer leichte Etappen, gute Ankommensmomente und Stops, die sich ohne Hektik geniessen lassen.";
  }
  if (route.tags.includes("food")) {
    return "Die Route funktioniert besonders gut, wenn du Orte mit Abendstimmung, Terrassen und starken kulinarischen Zwischenstopps suchst.";
  }
  if (route.tags.includes("nature") || route.tags.includes("adventure")) {
    return "Der Reiz liegt vor allem im Wechsel aus Anfahrt, Aussicht und genau den Orten, an denen Landschaft und Stimmung sofort greifen.";
  }
  if (route.tags.includes("culture")) {
    return "Sie lebt vom Kontrast aus historischen Kernen, markanten Stadtbildern und Stops, die auch ohne durchgetaktetes Programm sofort etwas erzaehlen.";
  }
  return "Die Route ist so aufgebaut, dass sie sich vom ersten Stop an stimmig anfuehlt und jeden Ortswechsel mit einem eigenen Charakter auflaedt.";
}

function buildRouteArc(route: RoadtripRoute): string {
  const stops = route.stops.map((stop) => stop.cityLabel);
  const first = stops[0] ?? "dem ersten Stop";
  const last = stops[stops.length - 1] ?? "dem Finale";
  const middle = stops.slice(1, -1);

  if (middle.length === 0) {
    return `Du startest in ${first} und laesst die Route in ${last} ausklingen.`;
  }
  if (middle.length === 1) {
    return `Du startest in ${first}, nimmst dir danach ${middle[0]} vor und landest zum Schluss in ${last}.`;
  }
  return `Du startest in ${first}, faehrst weiter ueber ${joinNatural(middle.slice(0, 3))} und landest zum Schluss in ${last}.`;
}

function buildSpotlight(stop: RoadtripRouteStop): RoadtripEditorialSpotlight {
  const firstPlannedStop = stop.plannedStops?.[0];
  const secondPlannedStop = stop.plannedStops?.[1];
  const planSummary = trimSentence(stop.planSummary);
  const title = firstPlannedStop?.label ?? `${stop.cityLabel} erleben`;

  let copy = planSummary;
  if (!copy && firstPlannedStop && secondPlannedStop) {
    copy = `${firstPlannedStop.hint}. Danach folgt ${secondPlannedStop.label.toLowerCase()} mit ${secondPlannedStop.hint.toLowerCase()}.`;
  } else if (!copy && firstPlannedStop) {
    copy = `${firstPlannedStop.label} setzt hier den Ton: ${firstPlannedStop.hint}.`;
  } else if (!copy) {
    copy = `${stop.cityLabel} ist als eigener Uebernachtungsstop gesetzt und bringt einen klaren Szenenwechsel in die Route.`;
  }

  return {
    city: stop.cityLabel,
    title,
    copy,
    nights: stop.nights,
  };
}

export function getRoadtripEditorial(route: RoadtripRoute): RoadtripEditorial {
  const coverArt = getRoadtripCoverArt(route);
  const coverImageUrl =
    route.cover_image_url ??
    COVER_IMAGE_BY_SLUG[route.slug] ??
    buildFallbackCoverImage(route);
  const firstStop = route.stops[0]?.cityLabel ?? "Start";
  const lastStop = route.stops[route.stops.length - 1]?.cityLabel ?? "Ziel";
  const stopSpotlights = route.stops.slice(0, 4).map(buildSpotlight);
  const routeDescription =
    trimSentence(route.description) ?? `${coverArt.scene}. ${buildRouteArc(route)}`;
  const intro = [
    `${routeDescription}.`,
    buildRouteArc(route),
    buildThemeSentence(route),
  ].join(" ");

  const highlights = [
    `${route.stops.length} Stopps mit ${route.total_nights} Naechten zwischen ${firstStop} und ${lastStop}.`,
    stopSpotlights[0]
      ? `${stopSpotlights[0].city} setzt frueh einen Ton mit ${stopSpotlights[0].title.toLowerCase()} und einem klaren Ankunftsmoment.`
      : "Die ersten Stops liefern direkt eine klare Stimmung fuer die gesamte Route.",
    stopSpotlights[1]
      ? `${stopSpotlights[1].city} bringt als naechster Block einen eigenen Charakter in die Route.`
      : "Die Ortswechsel fuehlen sich bewusst gesetzt statt beliebig an.",
  ];

  return {
    coverImageUrl,
    coverImageAlt: `${route.title} zwischen ${firstStop} und ${lastStop}`,
    teaser: `${routeDescription}.`,
    intro,
    highlights,
    stopSpotlights,
  };
}
