// Category-specific Unsplash photo fallbacks für Stop-Cards.
// Wenn eine Location kein eigenes Bild hat, wählen wir aus einer kuratierten
// Liste pro Kategorie ein deterministisches Stockfoto (basierend auf einer
// stable hash der ID). So sieht jeder Stop immer gleich aus, aber unterschiedliche
// Stops derselben Kategorie bekommen verschiedene Fotos.
//
// Unsplash images.unsplash.com URLs sind frei nutzbar ohne API-Key. Photo-IDs
// sind kuratiert für Lifestyle-Atmosphäre, nicht für scharfe Produktshots.

type FallbackCategory = "restaurant" | "cafe" | "culture" | "activity" | "nightlife" | "event" | "default";

const FALLBACKS: Record<FallbackCategory, string[]> = {
  restaurant: [
    "photo-1517248135467-4c7edcad34c4", // gedeckter Tisch, warm
    "photo-1414235077428-338989a2e8c0", // restaurant innen
    "photo-1555396273-367ea4eb4db5", // bistro
    "photo-1559339352-11d035aa65de", // dinner candles
  ],
  cafe: [
    "photo-1554118811-1e0d58224f24", // cafe latte art
    "photo-1442512595331-e89e73853f31", // cozy cafe
    "photo-1497935586351-b67a49e012bf", // breakfast spread
    "photo-1495474472287-4d71bcdd2085", // coffee shop morning
  ],
  culture: [
    "photo-1565060169187-5284992c6fb6", // museum architecture
    "photo-1518998053901-5348d3961a04", // gallery interior
    "photo-1544967082-d9d25d867d66", // art exhibition
    "photo-1574375927938-d5a98e8ffe85", // museum hall
  ],
  activity: [
    "photo-1517649763962-0c623066013b", // outdoor activity
    "photo-1502602898657-3e91760cbb34", // park afternoon
    "photo-1564013799919-ab600027ffc6", // park family
    "photo-1568376794508-ae52c6ab3929", // garden path
  ],
  nightlife: [
    "photo-1514933651103-005eec06c04b", // bar atmosphere
    "photo-1572116469696-31de0f17cc34", // cocktail bar
    "photo-1470337458703-46ad1756a187", // pub interior
    "photo-1572116469694-9d3a4a4f3a4a", // nightclub
  ],
  event: [
    "photo-1492684223066-81342ee5ff30", // concert crowd
    "photo-1501281668745-f7f57925c3b4", // event lights
    "photo-1429962714451-bb934ecdc4ec", // festival stage
    "photo-1470229722913-7c0e2dbbafd3", // performance
  ],
  default: [
    "photo-1499856871958-5b9627545d1a", // urban street
    "photo-1490644658840-3f2e3f8c5625", // city evening
    "photo-1502602898657-3e91760cbb34", // green space
  ],
};

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function categoryFor(input: { category?: string | null; type?: string | null; sourcePrimary?: string | null }): FallbackCategory {
  const category = (input.category ?? "").toLowerCase();
  const type = (input.type ?? "").toLowerCase();
  const sp = (input.sourcePrimary ?? "").toLowerCase();

  if (sp === "planner_event" || category === "event") return "event";
  if (category === "restaurant" || type.includes("restaurant") || type.includes("food")) return "restaurant";
  if (category === "cafe" || type.includes("cafe") || type.includes("coffee") || type.includes("bakery")) return "cafe";
  if (category === "nightlife" || type.includes("bar") || type.includes("pub") || type.includes("club") || type.includes("biergarten")) return "nightlife";
  if (category === "culture" || type.includes("museum") || type.includes("gallery") || type.includes("theatre") || type.includes("cinema")) return "culture";
  if (category === "activity" || type.includes("park") || type.includes("garden") || type.includes("attraction") || type.includes("viewpoint") || type.includes("tour")) return "activity";
  return "default";
}

/**
 * Returns a deterministic Unsplash fallback URL for a stop without its own photo.
 * The seed should be stable per stop (z.B. stop.id) so the same stop always
 * shows the same photo across renders.
 */
export function stopPhotoFallback(params: {
  category?: string | null;
  type?: string | null;
  sourcePrimary?: string | null;
  seed: string;
  width?: number;
  height?: number;
}): string {
  const cat = categoryFor(params);
  const pool = FALLBACKS[cat];
  const photoId = pool[stableHash(params.seed) % pool.length];
  const w = params.width ?? 200;
  const h = params.height ?? 200;
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}
