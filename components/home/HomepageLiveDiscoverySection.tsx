import Link from "next/link";
import { PD24Card, PD24SectionIntro, PD24StatusBadge } from "@/components/ui/pd24";
import { getSupabaseAdmin } from "@/lib/monetization/admin-server";
import { inferPublicRouteBadges } from "@/lib/routes/public-route-badges";
import {
  buildCityLookupMap,
  formatCityWithCountry,
  type CityLookupRow,
} from "@/lib/routes/public-location-label";
import { renderableImageUrl } from "@/lib/renderable-image-url";
import ImageAttribution from "@/components/ImageAttribution";

type CreatorType = "user" | "creator" | "influencer" | "brand" | "editorial";

type HomepageRouteRow = {
  id: string;
  creator_profile_id: string | null;
  city_slug: string | null;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  creator_type: CreatorType;
  stop_count: number | null;
  required_stop_count: number | null;
  bookmark_count: number | null;
  like_count: number | null;
  is_featured: boolean | null;
  tags?: unknown;
  meta?: unknown;
};

type HomepageCreatorRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  home_city_slug: string | null;
  creator_type: CreatorType;
  is_verified: boolean | null;
  is_featured: boolean | null;
  route_count: number | null;
  follower_count: number | null;
  total_likes_received: number | null;
  total_bookmarks_received: number | null;
};

type HomepageDiscoverySnapshot = {
  routes: HomepageRouteRow[];
  creator: HomepageCreatorRow | null;
  cityMap: Map<string, CityLookupRow>;
};

type ProofMetric = {
  value: string;
  label: string;
};

const HOMEPAGE_QUALITY_GATES = [
  {
    value: "3+ Stops",
    label: "genug Struktur fuer einen echten Tagesablauf",
  },
  {
    value: "Keine Tests",
    label: "Platzhalter- und Testprofile bleiben aus der Homepage",
  },
  {
    value: "Quelle klar",
    label: "Creator-, Featured- oder verifizierte Signale werden bevorzugt",
  },
];

const EXPLORE_STEPS = [
  "1 Gepruefte Route oeffnen",
  "2 Stil und Stops pruefen",
  "3 Als Vorlage uebernehmen",
];

const HOMEPAGE_TEXT_BLOCKLIST = [
  "test user",
  "dummy",
  "lorem",
  "asdf",
  "platzhalter",
  "beispielroute",
];
const HOMEPAGE_TEXT_BLOCK_PATTERNS = [/(^|[^a-z0-9])test([^a-z0-9]|$)/];

const EMPTY_ROUTE_CARDS = [
  {
    eyebrow: "Qualitaetsfilter aktiv",
    title: "Nur homepage-reife Routen werden sichtbar",
    body: "Fehlen Struktur, Quelle oder oeffentliche Qualitaet, bleibt die Route in Explore statt auf der Startseite.",
    actionLabel: "Explore pruefen",
  },
  {
    eyebrow: "Creator Proof",
    title: "Neue Routen brauchen ein belastbares Profil",
    body: "Sobald Creator-Routen genug Stops, Kontext und Vertrauen mitbringen, erscheinen sie hier als Premium-Einstieg.",
    actionLabel: "Routen ansehen",
  },
];

const CREATOR_EMPTY_CRITERIA = [
  "oeffentliche Routenleistung",
  "verifizierter oder featured Status",
  "keine Test- oder Platzhalterprofile",
];

function safeSlugFromTitle(title: string | null | undefined) {
  if (!title) return null;
  const s = title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || null;
}

function routeHref(route: Pick<HomepageRouteRow, "slug" | "title"> | null | undefined) {
  if (!route) return "/explore";
  const slug = route.slug ?? safeSlugFromTitle(route.title);
  return slug ? `/routes/${slug}` : "/explore";
}

function creatorHref(creator: Pick<HomepageCreatorRow, "username"> | null | undefined) {
  return creator?.username ? `/creator/${creator.username}` : "/explore";
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", { notation: "compact" }).format(value ?? 0);
}

function positiveCompactNumber(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? compactNumber(value) : null;
}

function initialsOf(name: string | null | undefined) {
  const text = name?.trim();
  if (!text) return "PD";
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function niceCreatorType(v: CreatorType | null | undefined) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  if (v === "editorial") return "Editorial";
  return "User";
}

function routeMetaLabel(route: HomepageRouteRow, cityMap: Map<string, CityLookupRow>) {
  const badges = inferPublicRouteBadges(route)
    .slice(0, 2)
    .map((badge) => badge.label);
  const stops =
    typeof route.stop_count === "number" && route.stop_count > 0
      ? `${route.stop_count} Stops`
      : "Route";
  const city = formatCityWithCountry(route.city_slug, cityMap);
  return [city, ...badges, stops].join(" | ");
}

function routeProofMetrics(route: HomepageRouteRow): ProofMetric[] {
  const stopCount = Math.max(route.stop_count ?? 0, 3);
  const socialSignals = (route.bookmark_count ?? 0) + (route.like_count ?? 0);
  const socialValue = positiveCompactNumber(socialSignals);

  return [
    {
      value: `${stopCount}+`,
      label: "Stops geprueft",
    },
    {
      value: route.is_featured ? "Featured" : niceCreatorType(route.creator_type),
      label: "Quelle",
    },
    {
      value: socialValue ?? "Kuratiert",
      label: socialValue ? "Community-Signal" : "Homepage-Freigabe",
    },
  ];
}

function routeProofChecklist(route: HomepageRouteRow) {
  const imageSignal = renderableImageUrl(route.cover_image_url)
    ? "Bildquelle hinterlegt"
    : "Premium-Fallback aktiv";
  return [
    "oeffentlich sichtbar",
    hasHomepageReadyRouteStructure(route) ? "Ablaufstruktur geprueft" : "Struktur in Pruefung",
    imageSignal,
  ];
}

function creatorProofMetrics(creator: HomepageCreatorRow): ProofMetric[] {
  const routeCount = positiveCompactNumber(creator.route_count);
  const followerCount = positiveCompactNumber(creator.follower_count);
  const engagement = positiveCompactNumber(
    (creator.total_likes_received ?? 0) + (creator.total_bookmarks_received ?? 0)
  );

  return [
    {
      value: routeCount ?? "Aktiv",
      label: routeCount ? "Routen" : "Routenprofil",
    },
    {
      value: engagement ?? (creator.is_verified ? "Verifiziert" : "Geprueft"),
      label: engagement ? "gespeicherte Signale" : "Qualitaetsstatus",
    },
    {
      value: followerCount ?? "Oeffentlich",
      label: followerCount ? "Follower" : "Profil sichtbar",
    },
  ];
}

function creatorProofChecklist(creator: HomepageCreatorRow) {
  return [
    creator.is_verified ? "verifiziertes Profil" : "Profilqualitaet geprueft",
    creator.is_featured ? "featured Creator" : `${niceCreatorType(creator.creator_type)}-Quelle`,
    (creator.route_count ?? 0) > 0 ? "oeffentliche Routenleistung" : "Routenbezug vorhanden",
  ];
}

function containsBlockedHomepageText(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return false;
    return (
      HOMEPAGE_TEXT_BLOCKLIST.some((blocked) => normalized.includes(blocked)) ||
      HOMEPAGE_TEXT_BLOCK_PATTERNS.some((pattern) => pattern.test(normalized))
    );
  });
}

function hasHomepageReadyRouteStructure(route: HomepageRouteRow) {
  const stopCount = route.stop_count ?? 0;
  const requiredStopCount = route.required_stop_count ?? 0;
  return stopCount >= Math.max(3, requiredStopCount);
}

function isHomepageReadyRoute(route: HomepageRouteRow) {
  const title = route.title?.trim();
  if (!title) return false;
  if (!route.slug && !safeSlugFromTitle(title)) return false;
  if (containsBlockedHomepageText(title, route.description)) return false;
  if (!hasHomepageReadyRouteStructure(route)) return false;
  return route.creator_type !== "user" || Boolean(route.is_featured);
}

function isHomepageReadyCreator(
  creator: HomepageCreatorRow,
  homepageRoutes: HomepageRouteRow[]
) {
  const publicName = creator.display_name?.trim() || creator.username?.trim();
  if (!publicName) return false;
  if (containsBlockedHomepageText(publicName, creator.username, creator.bio)) return false;

  const hasPublicRouteSignal =
    (creator.route_count ?? 0) > 0 ||
    homepageRoutes.some((route) => route.creator_profile_id === creator.id);
  if (!hasPublicRouteSignal) return false;

  return (
    creator.creator_type !== "user" ||
    Boolean(creator.is_verified) ||
    Boolean(creator.is_featured)
  );
}

async function loadHomepageDiscovery(): Promise<HomepageDiscoverySnapshot> {
  try {
    const supabase = getSupabaseAdmin();
    const [routesResp, creatorsResp, citiesResp] = await Promise.all([
      supabase
        .from("user_routes")
        .select(
          "id,creator_profile_id,city_slug,title,slug,description,cover_image_url,creator_type,stop_count,required_stop_count,bookmark_count,like_count,is_featured,tags,meta"
        )
        .eq("visibility", "public")
        .limit(16),
      supabase
        .from("creator_profiles")
        .select(
          "id,username,display_name,bio,avatar_url,home_city_slug,creator_type,is_verified,is_featured,route_count,follower_count,total_likes_received,total_bookmarks_received"
        )
        .limit(16),
      supabase.from("cities").select("slug,name,country_code").limit(500),
    ]);

    const routes = ((routesResp.data ?? []) as HomepageRouteRow[])
      .filter(isHomepageReadyRoute)
      .sort((a, b) => {
        const featureDelta = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
        if (featureDelta !== 0) return featureDelta;
        const scoreA = (a.bookmark_count ?? 0) + (a.like_count ?? 0) * 2 + (a.stop_count ?? 0);
        const scoreB = (b.bookmark_count ?? 0) + (b.like_count ?? 0) * 2 + (b.stop_count ?? 0);
        return scoreB - scoreA;
      })
      .slice(0, 2);

    const cityMap = buildCityLookupMap((citiesResp.data ?? []) as CityLookupRow[]);
    const creators = ((creatorsResp.data ?? []) as HomepageCreatorRow[]).sort((a, b) => {
      const featureDelta = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
      if (featureDelta !== 0) return featureDelta;
      return (b.follower_count ?? 0) - (a.follower_count ?? 0);
    });

    const creator =
      creators.find(
        (candidate) =>
          isHomepageReadyCreator(candidate, routes) &&
          routes.some((route) => route.creator_profile_id && route.creator_profile_id === candidate.id)
      ) ??
      creators.find((candidate) => isHomepageReadyCreator(candidate, routes)) ??
      null;

    return { routes, creator, cityMap };
  } catch {
    return {
      routes: [],
      creator: null,
      cityMap: new Map<string, CityLookupRow>(),
    };
  }
}

function EmptyRouteCard({
  body,
  eyebrow,
  title,
  actionLabel,
}: {
  body: string;
  eyebrow: string;
  title: string;
  actionLabel: string;
}) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-[rgba(17,24,39,0.08)] bg-[#f8fafc]">
      <div className="relative h-40 bg-[linear-gradient(135deg,#e5eaee,#f8fafc)]">
        <div className="absolute left-5 top-5 rounded-full border border-[rgba(17,24,39,0.08)] bg-white/82 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586373]">
          Proof Gate
        </div>
        <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2">
          {["Quelle", "Stops", "Kontext"].map((item) => (
            <div
              key={item}
              className="rounded-[16px] border border-white/70 bg-white/72 px-3 py-2 text-center text-[11px] font-medium text-[#586373]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#111827]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#586373]">
          {body}
        </p>
        <Link
          href="/explore"
          className="mt-5 inline-flex rounded-full border border-[rgba(17,24,39,0.1)] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition hover:border-[rgba(17,24,39,0.18)]"
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

function CreatorAvatar({ creator }: { creator: HomepageCreatorRow }) {
  const avatarUrl = renderableImageUrl(creator.avatar_url);
  const label = creator.display_name ?? creator.username ?? "Creator";

  if (avatarUrl) {
    return (
      <div
        aria-label={label}
        role="img"
        className="h-14 w-14 shrink-0 rounded-[20px] bg-cover bg-center"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#334155] text-lg font-semibold text-white">
      {initialsOf(creator.display_name ?? creator.username)}
    </div>
  );
}

function CreatorProofContent({
  creator,
  cityMap,
}: {
  creator: HomepageCreatorRow;
  cityMap: Map<string, CityLookupRow>;
}) {
  const proofMetrics = creatorProofMetrics(creator);
  const proofChecklist = creatorProofChecklist(creator);

  return (
    <>
      <div className="mt-4 flex items-center gap-4 rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
        <CreatorAvatar creator={creator} />
        <div className="min-w-0">
          <div className="text-lg font-semibold">
            {creator.display_name ?? creator.username ?? "Creator"}
          </div>
          <div className="mt-1 text-sm leading-6 text-[rgba(255,255,255,0.72)]">
            {creator.bio?.trim() ||
              `${niceCreatorType(creator.creator_type)} mit oeffentlichen Routen auf PerfectDay24`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-medium text-[rgba(255,255,255,0.72)]">
          {niceCreatorType(creator.creator_type)}
        </span>
        {creator.home_city_slug ? (
          <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-medium text-[rgba(255,255,255,0.72)]">
            {formatCityWithCountry(creator.home_city_slug, cityMap)}
          </span>
        ) : null}
        {creator.is_verified ? (
          <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-medium text-[rgba(255,255,255,0.72)]">
            Verifiziert
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {proofMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[18px] bg-[rgba(255,255,255,0.06)] px-3 py-3"
          >
            <div className="text-lg font-semibold">{metric.value}</div>
            <div className="text-sm text-[rgba(255,255,255,0.72)]">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
          Warum sichtbar
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {proofChecklist.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-medium text-[rgba(255,255,255,0.72)]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <Link
        href={creatorHref(creator)}
        className="mt-5 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgba(255,255,255,0.1)]"
      >
        Creator ansehen
      </Link>
    </>
  );
}

export default async function HomepageLiveDiscoverySection() {
  const { routes, creator, cityMap } = await loadHomepageDiscovery();

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] scroll-mt-28">
      <PD24Card padding="lg">
        <div className="inline-flex flex-wrap items-center gap-2 rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-white/90 px-3 py-3">
          <span className="rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            Mit Route starten
          </span>
          <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]">
            Fertige Dramaturgie
          </span>
          <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]">
            Direkt uebernehmen
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <PD24SectionIntro
            eyebrow="Explore"
            title="Starte mit einer geprueften Route und passe sie danach an."
            body="Wenn du lieber erst einen Stil sehen willst als mit einem leeren Rahmen zu beginnen, springst du hier in ausgewaehlte oeffentliche Creator-Routen und nutzt sie als Vorlage."
          />
          <PD24StatusBadge tone="info">Geprueft aus Explore</PD24StatusBadge>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {HOMEPAGE_QUALITY_GATES.map((gate) => (
            <div
              key={gate.value}
              className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-white/88 px-4 py-4"
            >
              <div className="text-lg font-semibold tracking-tight text-[#111827]">
                {gate.value}
              </div>
              <div className="mt-2 text-xs leading-5 text-[#586373]">{gate.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {EXPLORE_STEPS.map((step) => (
            <div
              key={step}
              className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-white px-4 py-3 text-sm font-medium text-[#111827]"
            >
              {step}
            </div>
          ))}
        </div>

        <div className="mt-3 text-sm leading-6 text-[#586373]">
          Dieser Einstieg ist gut, wenn du dich schneller entscheiden willst und lieber mit einer
          bereits strukturierten Dramaturgie beginnst.
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {routes.length > 0
            ? routes.map((route, index) => {
                const coverImageUrl = renderableImageUrl(route.cover_image_url);
                const proofMetrics = routeProofMetrics(route);
                const proofChecklist = routeProofChecklist(route);
                const routeBadges = inferPublicRouteBadges(route).slice(0, 3);

                return (
                <article
                  key={route.id}
                  className="group overflow-hidden rounded-[24px] border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] transition hover:border-[rgba(17,24,39,0.16)] hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
                >
                  <div
                    className={`relative h-40 ${
                      coverImageUrl
                        ? "bg-cover bg-center"
                        : index === 0
                          ? "bg-[linear-gradient(180deg,#dbe5eb,#edf2f4)]"
                          : "bg-[linear-gradient(180deg,#e5eaee,#f5f7f9)]"
                    }`}
                    style={
                      coverImageUrl
                        ? { backgroundImage: `url(${coverImageUrl})` }
                        : undefined
                    }
                  >
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <PD24StatusBadge tone={route.is_featured ? "info" : "neutral"}>
                        {route.is_featured ? "Empfohlene Route" : "Oeffentliche Route"}
                      </PD24StatusBadge>
                    </div>
                    {coverImageUrl ? (
                      <ImageAttribution
                        meta={route.meta}
                        compact
                        tone="dark"
                        className="absolute inset-x-4 bottom-4 truncate rounded-full bg-black/55 px-3 py-1 backdrop-blur"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
                      {formatCityWithCountry(route.city_slug, cityMap)}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#111827]">
                      {route.title?.trim() || "Unbenannte Route"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#586373]">
                      {routeMetaLabel(route, cityMap)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {routeBadges.map((badge) => (
                          <span
                            key={`${route.id}-${badge.label}`}
                            className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white px-3 py-1.5 text-xs font-medium text-[#586373]"
                          >
                            {badge.label}
                          </span>
                        ))}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {proofMetrics.map((metric) => (
                        <div
                          key={`${route.id}-${metric.label}`}
                          className="rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-white px-3 py-3"
                        >
                          <div className="text-base font-semibold text-[#111827]">
                            {metric.value}
                          </div>
                          <div className="mt-1 text-[11px] leading-4 text-[#586373]">
                            {metric.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-white/76 px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#586373]">
                        Warum sichtbar
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {proofChecklist.map((item) => (
                          <span
                            key={`${route.id}-${item}`}
                            className="rounded-full bg-[#eef2f5] px-3 py-1.5 text-xs font-medium text-[#586373]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-[#586373]">
                      Gut, wenn du lieber mit einem starken Beispiel startest und darauf aufbauend
                      weiterplanst.
                    </p>

                    <Link
                      href={routeHref(route)}
                      className="mt-5 inline-flex rounded-full border border-[rgba(17,24,39,0.1)] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition group-hover:border-[rgba(17,24,39,0.18)]"
                    >
                      Route als Vorlage uebernehmen
                    </Link>
                  </div>
                </article>
                );
              })
            : EMPTY_ROUTE_CARDS.map((card) => (
                <EmptyRouteCard
                  key={card.title}
                  eyebrow={card.eyebrow}
                  title={card.title}
                  body={card.body}
                  actionLabel={card.actionLabel}
                />
              ))}
        </div>
      </PD24Card>

      <PD24Card tone="dark">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">
            Geprueftes Profil
          </div>
          <PD24StatusBadge tone="info">Homepage-geeignet</PD24StatusBadge>
        </div>
        {creator ? (
          <CreatorProofContent creator={creator} cityMap={cityMap} />
        ) : (
          <>
            <div className="mt-4 rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4 text-sm leading-7 text-[rgba(255,255,255,0.72)]">
              Sobald Creator-Profile genug oeffentliche Qualitaet und Routenleistung mitbringen,
              zeigen wir hier ein vertrauenswuerdiges Profil.
            </div>
            <div className="mt-4 space-y-2">
              {CREATOR_EMPTY_CRITERIA.map((criterion) => (
                <div
                  key={criterion}
                  className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-3 text-sm text-[rgba(255,255,255,0.72)]"
                >
                  {criterion}
                </div>
              ))}
            </div>
            <Link
              href="/explore"
              className="mt-5 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgba(255,255,255,0.1)]"
            >
              Explore ansehen
            </Link>
          </>
        )}
      </PD24Card>
    </section>
  );
}
