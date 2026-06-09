import type { RoadtripRoute } from "@/lib/roadtrip/types";

export type RoadtripCoverArt = {
  icon: string;
  eyebrow: string;
  scene: string;
  accent: string;
  backgroundImage: string;
  orbImage: string;
};

type RouteCoverSeed = Pick<RoadtripRoute, "slug" | "tags" | "occasion">;

const FALLBACK_COVER_ART: RoadtripCoverArt = {
  icon: "Map",
  eyebrow: "Roadtrip",
  scene: "Mehrere Staedte, ein starker Flow",
  accent: "#b76a43",
  backgroundImage:
    "linear-gradient(135deg, rgba(22, 78, 99, 0.92) 0%, rgba(15, 23, 42, 0.88) 52%, rgba(180, 83, 9, 0.78) 100%)",
  orbImage:
    "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.26), transparent 0 26%), radial-gradient(circle at 86% 14%, rgba(251,191,36,0.24), transparent 0 22%), radial-gradient(circle at 72% 78%, rgba(125,211,252,0.2), transparent 0 24%)",
};

const COVER_ART_BY_SLUG: Record<string, RoadtripCoverArt> = {
  "hanse-sea-city-loop": {
    icon: "Harbour",
    eyebrow: "Nordsee & Hansestaedte",
    scene: "Brick lanes, piers and sea breeze",
    accent: "#0f766e",
    backgroundImage:
      "linear-gradient(135deg, rgba(14, 116, 144, 0.96) 0%, rgba(8, 47, 73, 0.92) 50%, rgba(245, 158, 11, 0.74) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.26), transparent 0 24%), radial-gradient(circle at 82% 18%, rgba(251,191,36,0.3), transparent 0 20%), radial-gradient(circle at 74% 76%, rgba(165,243,252,0.24), transparent 0 24%)",
  },
  "east-germany-design-history-loop": {
    icon: "Boulevard",
    eyebrow: "Design & Geschichte",
    scene: "Capitals, courtyards and long city nights",
    accent: "#7c3aed",
    backgroundImage:
      "linear-gradient(135deg, rgba(55, 48, 163, 0.95) 0%, rgba(30, 41, 59, 0.94) 55%, rgba(219, 39, 119, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 22% 18%, rgba(224,231,255,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(244,114,182,0.26), transparent 0 20%), radial-gradient(circle at 72% 80%, rgba(147,197,253,0.18), transparent 0 24%)",
  },
  "ruhr-industriekultur-after-dark": {
    icon: "Steel",
    eyebrow: "Industrie bei Nacht",
    scene: "Brick, steel and city lights after dark",
    accent: "#ea580c",
    backgroundImage:
      "linear-gradient(135deg, rgba(24, 24, 27, 0.96) 0%, rgba(41, 37, 36, 0.95) 48%, rgba(249, 115, 22, 0.82) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.12), transparent 0 20%), radial-gradient(circle at 84% 16%, rgba(251,146,60,0.3), transparent 0 18%), radial-gradient(circle at 76% 80%, rgba(253,224,71,0.12), transparent 0 22%)",
  },
  "black-forest-spa-city-loop": {
    icon: "Forest",
    eyebrow: "Schwarzwald & Spa",
    scene: "Pines, wine bars and polished evenings",
    accent: "#15803d",
    backgroundImage:
      "linear-gradient(135deg, rgba(22, 101, 52, 0.95) 0%, rgba(21, 128, 61, 0.82) 38%, rgba(146, 64, 14, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(220,252,231,0.2), transparent 0 22%), radial-gradient(circle at 84% 18%, rgba(253,224,71,0.22), transparent 0 18%), radial-gradient(circle at 76% 78%, rgba(251,191,36,0.16), transparent 0 24%)",
  },
  "franconia-bavaria-slow-drive": {
    icon: "Castle",
    eyebrow: "Bayern langsam erleben",
    scene: "Beer gardens, old towns and warm squares",
    accent: "#1d4ed8",
    backgroundImage:
      "linear-gradient(135deg, rgba(30, 64, 175, 0.94) 0%, rgba(15, 23, 42, 0.92) 54%, rgba(245, 158, 11, 0.74) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(219,234,254,0.24), transparent 0 22%), radial-gradient(circle at 84% 18%, rgba(253,224,71,0.26), transparent 0 18%), radial-gradient(circle at 72% 80%, rgba(254,215,170,0.18), transparent 0 22%)",
  },
  "rhine-main-wine-city-loop": {
    icon: "Wine",
    eyebrow: "Rhein, Main & Terrassen",
    scene: "Cathedrals, skyline and evening wine stops",
    accent: "#9f1239",
    backgroundImage:
      "linear-gradient(135deg, rgba(136, 19, 55, 0.95) 0%, rgba(51, 65, 85, 0.9) 50%, rgba(249, 115, 22, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 20%, rgba(255,241,242,0.2), transparent 0 20%), radial-gradient(circle at 82% 16%, rgba(251,191,36,0.24), transparent 0 18%), radial-gradient(circle at 76% 80%, rgba(191,219,254,0.18), transparent 0 24%)",
  },
  "alpine-lakes-borderline": {
    icon: "Alps",
    eyebrow: "Alpen & Seen",
    scene: "Glacier blues, peaks and cross-border calm",
    accent: "#2563eb",
    backgroundImage:
      "linear-gradient(135deg, rgba(37, 99, 235, 0.94) 0%, rgba(14, 116, 144, 0.86) 42%, rgba(15, 23, 42, 0.9) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.28), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(125,211,252,0.24), transparent 0 20%), radial-gradient(circle at 72% 80%, rgba(191,219,254,0.22), transparent 0 24%)",
  },
  "slovenia-lakes-to-sea": {
    icon: "River",
    eyebrow: "Seen bis Adria",
    scene: "Emerald water, quiet towns and sea air",
    accent: "#0f766e",
    backgroundImage:
      "linear-gradient(135deg, rgba(5, 150, 105, 0.94) 0%, rgba(8, 145, 178, 0.84) 46%, rgba(30, 64, 175, 0.86) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(220,252,231,0.2), transparent 0 22%), radial-gradient(circle at 82% 14%, rgba(147,197,253,0.24), transparent 0 18%), radial-gradient(circle at 76% 82%, rgba(103,232,249,0.22), transparent 0 24%)",
  },
  "istria-sunset-loop": {
    icon: "Sunset",
    eyebrow: "Istrien bei Goldlicht",
    scene: "Harbours, hill towns and late apertivo light",
    accent: "#c2410c",
    backgroundImage:
      "linear-gradient(135deg, rgba(251, 146, 60, 0.92) 0%, rgba(234, 88, 12, 0.86) 38%, rgba(49, 46, 129, 0.88) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 20%, rgba(255,237,213,0.24), transparent 0 22%), radial-gradient(circle at 82% 18%, rgba(253,186,116,0.26), transparent 0 20%), radial-gradient(circle at 74% 80%, rgba(165,180,252,0.2), transparent 0 24%)",
  },
  "highlands-coastline-run": {
    icon: "Coast",
    eyebrow: "Highlands & Coastline",
    scene: "Remote beaches, passes and windblown nights",
    accent: "#166534",
    backgroundImage:
      "linear-gradient(135deg, rgba(22, 101, 52, 0.95) 0%, rgba(31, 41, 55, 0.92) 44%, rgba(14, 165, 233, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(220,252,231,0.18), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(125,211,252,0.2), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(254,249,195,0.14), transparent 0 24%)",
  },
  "norway-fjords-icons": {
    icon: "Fjord",
    eyebrow: "Fjorde & Aussicht",
    scene: "Switchbacks, water walls and deep blue calm",
    accent: "#0284c7",
    backgroundImage:
      "linear-gradient(135deg, rgba(2, 132, 199, 0.94) 0%, rgba(30, 64, 175, 0.88) 42%, rgba(15, 23, 42, 0.92) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(224,242,254,0.22), transparent 0 22%), radial-gradient(circle at 84% 14%, rgba(125,211,252,0.22), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(255,255,255,0.16), transparent 0 24%)",
  },
  "baltic-islands-family-loop": {
    icon: "Pier",
    eyebrow: "Ostsee mit Familie",
    scene: "Piers, sea promenades and easy family pacing",
    accent: "#0ea5e9",
    backgroundImage:
      "linear-gradient(135deg, rgba(14, 165, 233, 0.92) 0%, rgba(8, 145, 178, 0.84) 46%, rgba(134, 239, 172, 0.7) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(240,249,255,0.24), transparent 0 22%), radial-gradient(circle at 84% 14%, rgba(187,247,208,0.24), transparent 0 18%), radial-gradient(circle at 76% 82%, rgba(255,255,255,0.18), transparent 0 24%)",
  },
  "harz-castles-steam-loop": {
    icon: "Steam",
    eyebrow: "Harz & Fachwerk",
    scene: "Castle silhouettes, timber lanes and mountain air",
    accent: "#6b4f2a",
    backgroundImage:
      "linear-gradient(135deg, rgba(101, 67, 33, 0.92) 0%, rgba(39, 39, 42, 0.92) 44%, rgba(21, 128, 61, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(254,243,199,0.18), transparent 0 22%), radial-gradient(circle at 84% 14%, rgba(187,247,208,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.12), transparent 0 24%)",
  },
  "moselle-wine-castle-curve": {
    icon: "Vineyard",
    eyebrow: "Mosel & Burgen",
    scene: "River bends, steep vineyards and castle dusk",
    accent: "#881337",
    backgroundImage:
      "linear-gradient(135deg, rgba(136, 19, 55, 0.94) 0%, rgba(113, 63, 18, 0.84) 42%, rgba(234, 179, 8, 0.62) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(255,241,242,0.2), transparent 0 20%), radial-gradient(circle at 84% 16%, rgba(253,224,71,0.24), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(254,215,170,0.16), transparent 0 24%)",
  },
  "german-wine-route-weekender": {
    icon: "Cellar",
    eyebrow: "Pfalz Weekend",
    scene: "Wine villages, terraces and warm late dinners",
    accent: "#be185d",
    backgroundImage:
      "linear-gradient(135deg, rgba(190, 24, 93, 0.92) 0%, rgba(249, 115, 22, 0.76) 44%, rgba(120, 53, 15, 0.82) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(252,231,243,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(253,186,116,0.24), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  "bavarian-castles-alpine-finish": {
    icon: "Summit",
    eyebrow: "Bayern & Alpenfinale",
    scene: "Castle lakes, mountain towns and long views",
    accent: "#1d4ed8",
    backgroundImage:
      "linear-gradient(135deg, rgba(29, 78, 216, 0.94) 0%, rgba(15, 23, 42, 0.9) 42%, rgba(250, 204, 21, 0.68) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(219,234,254,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(253,224,71,0.26), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(191,219,254,0.18), transparent 0 24%)",
  },
  "lake-constance-grand-loop": {
    icon: "Lake",
    eyebrow: "Bodensee Grand Loop",
    scene: "Lake promenades, island towns and summer blue",
    accent: "#0284c7",
    backgroundImage:
      "linear-gradient(135deg, rgba(2, 132, 199, 0.92) 0%, rgba(99, 102, 241, 0.74) 42%, rgba(134, 239, 172, 0.62) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(224,242,254,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(196,181,253,0.2), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(187,247,208,0.18), transparent 0 24%)",
  },
  "salzkammergut-lakes-escape": {
    icon: "Spa",
    eyebrow: "Seen & Belle Epoque",
    scene: "Mirror lakes, spa calm and alpine light",
    accent: "#0891b2",
    backgroundImage:
      "linear-gradient(135deg, rgba(8, 145, 178, 0.94) 0%, rgba(51, 65, 85, 0.9) 44%, rgba(148, 163, 184, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(207,250,254,0.22), transparent 0 22%), radial-gradient(circle at 84% 14%, rgba(191,219,254,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.16), transparent 0 24%)",
  },
  "dolomites-great-passes": {
    icon: "Pass",
    eyebrow: "Dolomiten Scenic Drive",
    scene: "Rock walls, switchbacks and cinematic altitude",
    accent: "#ea580c",
    backgroundImage:
      "linear-gradient(135deg, rgba(120, 53, 15, 0.96) 0%, rgba(71, 85, 105, 0.88) 44%, rgba(251, 146, 60, 0.76) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(254,243,199,0.18), transparent 0 20%), radial-gradient(circle at 84% 16%, rgba(253,186,116,0.22), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(226,232,240,0.16), transparent 0 24%)",
  },
  "alsace-black-forest-borderline": {
    icon: "Village",
    eyebrow: "Elsass & Schwarzwald",
    scene: "Timber facades, wine bars and spa polish",
    accent: "#be123c",
    backgroundImage:
      "linear-gradient(135deg, rgba(190, 24, 93, 0.9) 0%, rgba(22, 101, 52, 0.82) 48%, rgba(250, 204, 21, 0.62) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(252,231,243,0.2), transparent 0 22%), radial-gradient(circle at 84% 14%, rgba(187,247,208,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(253,224,71,0.16), transparent 0 24%)",
  },
  "andalusia-white-villages-run": {
    icon: "Sun",
    eyebrow: "Andalusien Roadmovie",
    scene: "White hill towns, tapas and canyon sunsets",
    accent: "#ea580c",
    backgroundImage:
      "linear-gradient(135deg, rgba(234, 88, 12, 0.9) 0%, rgba(217, 119, 6, 0.82) 42%, rgba(30, 41, 59, 0.86) 100%)",
    orbImage:
      "radial-gradient(circle at 20% 18%, rgba(255,237,213,0.24), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(253,186,116,0.28), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(254,249,195,0.14), transparent 0 24%)",
  },
};

const FALLBACK_BY_OCCASION: Record<string, Partial<RoadtripCoverArt>> = {
  family: {
    icon: "Family",
    eyebrow: "Familien-Roadtrip",
    scene: "Mehr Pausen, mehr Leichtigkeit, mehr Erinnerungen",
    accent: "#0ea5e9",
    backgroundImage:
      "linear-gradient(135deg, rgba(14, 165, 233, 0.92) 0%, rgba(8, 145, 178, 0.84) 44%, rgba(134, 239, 172, 0.72) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.24), transparent 0 22%), radial-gradient(circle at 82% 16%, rgba(187,247,208,0.24), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(224,242,254,0.2), transparent 0 24%)",
  },
  date: {
    icon: "Aperitivo",
    eyebrow: "Zu zweit unterwegs",
    scene: "Goldenes Licht, gute Tische und ein weicher Flow",
    accent: "#be185d",
    backgroundImage:
      "linear-gradient(135deg, rgba(190, 24, 93, 0.92) 0%, rgba(249, 115, 22, 0.74) 44%, rgba(51, 65, 85, 0.86) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(252,231,243,0.22), transparent 0 22%), radial-gradient(circle at 82% 16%, rgba(253,186,116,0.24), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  friends: {
    icon: "Crew",
    eyebrow: "Mit Freunden",
    scene: "Abende, Aussicht und starke gemeinsame Momente",
    accent: "#7c3aed",
    backgroundImage:
      "linear-gradient(135deg, rgba(124, 58, 237, 0.92) 0%, rgba(79, 70, 229, 0.82) 42%, rgba(14, 165, 233, 0.7) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(233,213,255,0.22), transparent 0 22%), radial-gradient(circle at 82% 16%, rgba(125,211,252,0.2), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  tourism: {
    icon: "Cities",
    eyebrow: "Staedtetrip",
    scene: "Altstaedte, Boulevards und starke Zwischenstopps",
    accent: "#2563eb",
    backgroundImage:
      "linear-gradient(135deg, rgba(37, 99, 235, 0.94) 0%, rgba(30, 64, 175, 0.84) 42%, rgba(15, 23, 42, 0.9) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(219,234,254,0.24), transparent 0 22%), radial-gradient(circle at 82% 16%, rgba(255,255,255,0.16), transparent 0 18%), radial-gradient(circle at 74% 80%, rgba(125,211,252,0.16), transparent 0 24%)",
  },
};

const FALLBACK_BY_TAG: Record<string, Partial<RoadtripCoverArt>> = {
  europe: {
    eyebrow: "Europa-Route",
    accent: "#2563eb",
    backgroundImage:
      "linear-gradient(135deg, rgba(37, 99, 235, 0.92) 0%, rgba(79, 70, 229, 0.8) 40%, rgba(8, 145, 178, 0.78) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(224,231,255,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(125,211,252,0.22), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  germany: {
    eyebrow: "Deutschland-Route",
    accent: "#b76a43",
    backgroundImage:
      "linear-gradient(135deg, rgba(180, 83, 9, 0.9) 0%, rgba(120, 53, 15, 0.86) 40%, rgba(30, 41, 59, 0.9) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(255,237,213,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(253,224,71,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  adventure: {
    icon: "Scenic",
    scene: "Paesse, Kuesten oder Ausblicke mit Roadmovie-Gefuehl",
    accent: "#0f766e",
    backgroundImage:
      "linear-gradient(135deg, rgba(15, 118, 110, 0.92) 0%, rgba(21, 128, 61, 0.84) 40%, rgba(15, 23, 42, 0.9) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(204,251,241,0.2), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(187,247,208,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  food: {
    icon: "Table",
    scene: "Starke Stops fuer Wein, Tavernen und Terrassen",
    accent: "#c2410c",
    backgroundImage:
      "linear-gradient(135deg, rgba(194, 65, 12, 0.9) 0%, rgba(249, 115, 22, 0.82) 40%, rgba(120, 53, 15, 0.86) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(255,237,213,0.22), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(253,186,116,0.22), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
  nature: {
    icon: "Outdoors",
    scene: "Mehr Weite, mehr Wasser, mehr Landschaft",
    accent: "#15803d",
    backgroundImage:
      "linear-gradient(135deg, rgba(21, 128, 61, 0.92) 0%, rgba(8, 145, 178, 0.78) 42%, rgba(30, 41, 59, 0.88) 100%)",
    orbImage:
      "radial-gradient(circle at 18% 18%, rgba(220,252,231,0.2), transparent 0 22%), radial-gradient(circle at 84% 16%, rgba(103,232,249,0.18), transparent 0 18%), radial-gradient(circle at 74% 82%, rgba(255,255,255,0.14), transparent 0 24%)",
  },
};

export function getRoadtripCoverArt(route: RouteCoverSeed): RoadtripCoverArt {
  const exact = COVER_ART_BY_SLUG[route.slug];
  if (exact) return exact;

  let merged: RoadtripCoverArt = { ...FALLBACK_COVER_ART };
  const occasionFallback = FALLBACK_BY_OCCASION[route.occasion];
  if (occasionFallback) {
    merged = { ...merged, ...occasionFallback };
  }
  for (const tag of route.tags) {
    const tagFallback = FALLBACK_BY_TAG[tag];
    if (tagFallback) {
      merged = { ...merged, ...tagFallback };
    }
  }
  if (route.occasion === "tourism") {
    merged = { ...merged, eyebrow: "Staedtetrip" };
    if (route.tags.includes("nature")) {
      merged = {
        ...merged,
        scene: "Gruene Boulevards, Wasserblicke und starke Stadtstopps",
      };
    }
    if (route.tags.includes("food")) {
      merged = {
        ...merged,
        scene: "Altstaedte, Tavernen und starke Zwischenstopps",
      };
    }
  }
  return merged;
}
