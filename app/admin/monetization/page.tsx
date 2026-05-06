import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import AdminEntityToggle from "@/components/monetization/AdminEntityToggle";
import {
  assertInternalMonetizationAdmin,
  getMonetizationAdminSnapshot,
} from "@/lib/monetization/admin-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("de-DE", { notation: "compact" }).format(value);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isInternalPilotCampaignName(name: string) {
  return name.startsWith("Internal Featured ");
}

function buildAdminFilterHref(
  current: { scope: string; signal: string; surface: string },
  patch: Partial<{ scope: string; signal: string; surface: string }>
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.scope !== "all") params.set("scope", next.scope);
  if (next.signal !== "all") params.set("signal", next.signal);
  if (next.surface !== "all") params.set("surface", next.surface);
  const query = params.toString();
  return query ? `/admin/monetization?${query}` : "/admin/monetization";
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-5">
        <div className="pd24-kicker mb-2">Admin</div>
        <h2 className="text-2xl font-semibold text-[var(--text-strong)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function MonetizationAdminPage(props: { searchParams?: Promise<any> | any }) {
  try {
    assertInternalMonetizationAdmin();
  } catch {
    notFound();
  }

  const resolvedSearchParams = await Promise.resolve(props.searchParams ?? {});
  const scopeFilter = firstSearchParam(resolvedSearchParams.scope) ?? "all";
  const signalFilter = firstSearchParam(resolvedSearchParams.signal) ?? "all";
  const surfaceFilter = firstSearchParam(resolvedSearchParams.surface) ?? "all";
  const activeFilters = {
    scope: scopeFilter,
    signal: signalFilter,
    surface: surfaceFilter,
  };

  const snapshot = await getMonetizationAdminSnapshot();

  const partnerById = new Map(snapshot.partners.map((partner) => [partner.id, partner]));
  const productById = new Map(snapshot.products.map((product) => [product.id, product]));
  const slotById = new Map(snapshot.slots.map((slot) => [slot.id, slot]));
  const creatorById = new Map(snapshot.creators.map((creator) => [creator.id, creator]));
  const routeById = new Map(snapshot.routes.map((route) => [route.id, route]));

  const activeSlots = snapshot.slots.filter((slot) => slot.status === "active").length;
  const activeCampaigns = snapshot.campaigns.filter((campaign) => campaign.status === "active").length;
  const activeAffiliates = snapshot.affiliateLinks.filter((link) => link.is_active).length;
  const activeProducts = snapshot.products.filter((product) => product.status === "active").length;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const internalCampaignIds = new Set(
    snapshot.campaigns.filter((campaign) => isInternalPilotCampaignName(campaign.name)).map((campaign) => campaign.id)
  );

  const filteredAttribution = snapshot.attribution.filter((row) => {
    if (surfaceFilter !== "all" && row.surface !== surfaceFilter) return false;
    if (scopeFilter === "internal") {
      const source = typeof row.metadata?.source === "string" ? row.metadata.source : "";
      if (!source.startsWith("internal_") && !(row.campaign_id && internalCampaignIds.has(row.campaign_id))) {
        return false;
      }
    }
    if (signalFilter === "clicks_today") {
      if (row.event_type !== "click") return false;
      const occurredAt = new Date(row.occurred_at);
      if (Number.isNaN(occurredAt.getTime()) || occurredAt < startOfToday) return false;
    }
    return true;
  });

  const attributionSummary = Object.entries(
    filteredAttribution.reduce<Record<string, number>>((acc, row) => {
      acc[row.event_type] = (acc[row.event_type] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count);

  const rewardCountByCreator = snapshot.rewards.reduce<Record<string, number>>((acc, reward) => {
    acc[reward.creator_profile_id] = (acc[reward.creator_profile_id] ?? 0) + 1;
    return acc;
  }, {});

  const routeCopyCountByCreator = snapshot.attribution.reduce<Record<string, number>>((acc, event) => {
    if (event.event_type !== "route_copy" || !event.creator_profile_id) return acc;
    acc[event.creator_profile_id] = (acc[event.creator_profile_id] ?? 0) + 1;
    return acc;
  }, {});

  const monetizationSurfaces = new Set(["explore", "planner", "shared_plan", "route_detail", "creator_profile"]);
  const conversionEventTypes = new Set(["plan_save", "share_activation", "route_copy"]);
  const revenueSignals = filteredAttribution.filter(
    (row) => row.surface && monetizationSurfaces.has(row.surface)
  );
  const clickSignals = revenueSignals.filter((row) => row.event_type === "click");
  const conversionSignals = revenueSignals.filter((row) => conversionEventTypes.has(row.event_type));
  const clicksTodayCount = clickSignals.filter((row) => {
    const occurredAt = new Date(row.occurred_at);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt >= startOfToday;
  }).length;
  const conversionsTodayCount = conversionSignals.filter((row) => {
    const occurredAt = new Date(row.occurred_at);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt >= startOfToday;
  }).length;

  const recentConversionSignals = conversionSignals.slice(0, 6).map((row) => ({
    ...row,
    creator: row.creator_profile_id ? creatorById.get(row.creator_profile_id) ?? null : null,
    route: row.route_id ? routeById.get(row.route_id) ?? null : null,
    partner: row.partner_profile_id ? partnerById.get(row.partner_profile_id) ?? null : null,
  }));

  const clicksByRail = Array.from(
    clickSignals.reduce<Map<string, number>>((acc, row) => {
      const surface = row.surface ?? "unknown";
      acc.set(surface, (acc.get(surface) ?? 0) + 1);
      return acc;
    }, new Map())
  )
    .map(([surface, count]) => ({ surface, count }))
    .sort((a, b) => b.count - a.count);

  const internalExplorePilots = snapshot.campaigns
    .filter((campaign) => campaign.name.startsWith("Internal Featured Explore Pilot:"))
    .map((campaign) => {
      const partner = partnerById.get(campaign.partner_profile_id) ?? null;
      const product = campaign.product_id ? productById.get(campaign.product_id) ?? null : null;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      const isLive = campaign.status === "active" && assignment?.status === "active";
      return { campaign, partner, product, assignment, slot, isLive };
    });

  const internalPlannerPilots = snapshot.campaigns
    .filter((campaign) => campaign.name.startsWith("Internal Featured Planner Pilot:"))
    .map((campaign) => {
      const partner = partnerById.get(campaign.partner_profile_id) ?? null;
      const product = campaign.product_id ? productById.get(campaign.product_id) ?? null : null;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      const isLive = campaign.status === "active" && assignment?.status === "active";
      return { campaign, partner, product, assignment, slot, isLive };
    });

  const internalSharePilots = snapshot.campaigns
    .filter((campaign) => campaign.name.startsWith("Internal Featured Shared Plan Pilot:"))
    .map((campaign) => {
      const partner = partnerById.get(campaign.partner_profile_id) ?? null;
      const product = campaign.product_id ? productById.get(campaign.product_id) ?? null : null;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      const isLive = campaign.status === "active" && assignment?.status === "active";
      return { campaign, partner, product, assignment, slot, isLive };
    });

  const internalRoutePilots = snapshot.campaigns
    .filter((campaign) => campaign.name.startsWith("Internal Featured Route Detail Pilot:"))
    .map((campaign) => {
      const partner = partnerById.get(campaign.partner_profile_id) ?? null;
      const product = campaign.product_id ? productById.get(campaign.product_id) ?? null : null;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      const isLive = campaign.status === "active" && assignment?.status === "active";
      return { campaign, partner, product, assignment, slot, isLive };
    });

  const internalCreatorProfilePilots = snapshot.campaigns
    .filter((campaign) => campaign.name.startsWith("Internal Featured Creator Profile Pilot:"))
    .map((campaign) => {
      const partner = partnerById.get(campaign.partner_profile_id) ?? null;
      const product = campaign.product_id ? productById.get(campaign.product_id) ?? null : null;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      const targetCreator = campaign.target_creator_profile_id
        ? creatorById.get(campaign.target_creator_profile_id) ?? null
        : null;
      const isLive = campaign.status === "active" && assignment?.status === "active";
      return { campaign, partner, product, assignment, slot, targetCreator, isLive };
    });

  const activePilotsByRail = Array.from(
    snapshot.campaigns.reduce<Map<string, number>>((acc, campaign) => {
      if (!isInternalPilotCampaignName(campaign.name)) return acc;
      const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
      const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
      if (!slot || campaign.status !== "active" || assignment?.status !== "active") return acc;
      if (surfaceFilter !== "all" && slot.surface !== surfaceFilter) return acc;
      acc.set(slot.surface, (acc.get(slot.surface) ?? 0) + 1);
      return acc;
    }, new Map())
  )
    .map(([surface, count]) => ({ surface, count }))
    .sort((a, b) => b.count - a.count);

  const creatorProfileCampaignIds = new Set(
    internalCreatorProfilePilots.map(({ campaign }) => campaign.id)
  );
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trendDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = dayKey(date);
    return {
      key,
      label: formatDayLabel(key),
      clicks: 0,
      conversions: 0,
    };
  });

  for (const row of clickSignals) {
    const key = dayKey(new Date(row.occurred_at));
    const bucket = trendDays.find((entry) => entry.key === key);
    if (bucket) bucket.clicks += 1;
  }

  for (const row of conversionSignals) {
    const key = dayKey(new Date(row.occurred_at));
    const bucket = trendDays.find((entry) => entry.key === key);
    if (bucket) bucket.conversions += 1;
  }

  const maxTrendValue = Math.max(
    1,
    ...trendDays.flatMap((entry) => [entry.clicks, entry.conversions])
  );

  const creatorProfileSignals = snapshot.attribution.filter((row) => {
    if (row.surface !== "creator_profile" || row.event_type !== "click") return false;
    const source = typeof row.metadata?.source === "string" ? row.metadata.source : "";
    return creatorProfileCampaignIds.has(row.campaign_id ?? "") || source.startsWith("internal_creator_profile_");
  });

  const creatorProfileClicksToday = creatorProfileSignals.filter((row) => {
    const occurredAt = new Date(row.occurred_at);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt >= startOfToday;
  });

  const creatorProfileClicks7d = creatorProfileSignals.filter((row) => {
    const occurredAt = new Date(row.occurred_at);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt >= sevenDaysAgo;
  });

  const creatorProfileCreatorsTouched = new Set(
    creatorProfileSignals.map((row) => row.creator_profile_id).filter((value): value is string => Boolean(value))
  ).size;

  const creatorProfileTopCreators = Array.from(
    creatorProfileSignals.reduce<Map<string, number>>((acc, row) => {
      if (!row.creator_profile_id) return acc;
      acc.set(row.creator_profile_id, (acc.get(row.creator_profile_id) ?? 0) + 1);
      return acc;
    }, new Map())
  )
    .map(([creatorId, count]) => ({
      creatorId,
      count,
      creator: creatorById.get(creatorId) ?? null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const creatorProfileRecentSignals = creatorProfileSignals.slice(0, 6).map((row) => ({
    ...row,
    creator: row.creator_profile_id ? creatorById.get(row.creator_profile_id) ?? null : null,
    route: row.route_id ? routeById.get(row.route_id) ?? null : null,
    partner: row.partner_profile_id ? partnerById.get(row.partner_profile_id) ?? null : null,
  }));

  const sortedCampaigns = [...snapshot.campaigns].sort((a, b) => {
    const priorityA =
      isInternalPilotCampaignName(a.name)
        ? 0
        : 1;
    const priorityB =
      isInternalPilotCampaignName(b.name)
        ? 0
        : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const visibleCampaigns = sortedCampaigns.filter((campaign) => {
    const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
    const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
    if (scopeFilter === "internal" && !isInternalPilotCampaignName(campaign.name)) return false;
    if (surfaceFilter !== "all" && slot?.surface !== surfaceFilter) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[36px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
              Revenue Ops Console
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text-strong)]">
              Monetization Admin
            </h1>
            <p className="mt-3 text-[var(--text-muted)]">
              Interne Steuerung und Auswertung für Slots, Partner, Kampagnen, Affiliate-Links,
              Attribution und Creator-Rewards. Gedacht für sauberes internes Testen, bevor einzelne
              Rails sichtbar aktiviert werden.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/explore?monetization=debug"
              className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-strong)]"
            >
              Explore Debug
            </Link>
            <Link
              href="/routes?monetization=debug"
              className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-strong)]"
            >
              Routes Debug
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Partner", value: compactNumber(snapshot.partners.length) },
            { label: "aktive Slots", value: compactNumber(activeSlots) },
            { label: "aktive Kampagnen", value: compactNumber(activeCampaigns) },
            { label: "aktive Affiliate-Links", value: compactNumber(activeAffiliates) },
            { label: "aktive Produkte", value: compactNumber(activeProducts) },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-black/5 bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <Section title="Overview" subtitle="Die wichtigsten Signale und der aktuelle Testzustand.">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="text-sm font-medium text-[var(--text-strong)]">Häufigste Monetization-Signale</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {attributionSummary.length > 0 ? (
                  attributionSummary.slice(0, 10).map((row) => (
                    <span
                      key={row.eventType}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[var(--text-strong)]"
                    >
                      {row.eventType}: {row.count}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">Noch keine Attribution-Signale.</span>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="text-sm font-medium text-[var(--text-strong)]">Aktive Test-Rails</div>
              <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                <div>Slots aktiv: {activeSlots}</div>
                <div>Kampagnen aktiv: {activeCampaigns}</div>
                <div>Affiliate-Links aktiv: {activeAffiliates}</div>
                <div>Produkte aktiv: {activeProducts}</div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Revenue-Ops Dashboard"
          subtitle="Tageszahlen, Rail-Vergleich und ein kleiner Trend-Block für die aktuelle Monetization-Lage."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "CTA-Klicks heute", value: compactNumber(clicksTodayCount) },
              { label: "Conversion-Signale heute", value: compactNumber(conversionsTodayCount) },
              {
                label: "aktive interne Piloten",
                value: compactNumber(activePilotsByRail.reduce((sum, entry) => sum + entry.count, 0)),
              },
              {
                label: "Rails mit Aktivitaet",
                value: compactNumber(new Set(clicksByRail.map((entry) => entry.surface)).size),
              },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="text-sm font-medium text-[var(--text-strong)]">Klicks pro Rail</div>
              <div className="mt-4 space-y-3">
                {clicksByRail.length > 0 ? (
                  clicksByRail.map((entry) => (
                    <div
                      key={entry.surface}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3"
                    >
                      <div className="text-sm font-medium text-[var(--text-strong)]">{entry.surface}</div>
                      <div className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
                        {entry.count}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[var(--text-muted)]">
                    Noch keine Klicksignale für die aktuelle Filterung.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="text-sm font-medium text-[var(--text-strong)]">Aktive Piloten pro Rail</div>
              <div className="mt-4 space-y-3">
                {activePilotsByRail.length > 0 ? (
                  activePilotsByRail.map((entry) => (
                    <div
                      key={entry.surface}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3"
                    >
                      <div className="text-sm font-medium text-[var(--text-strong)]">{entry.surface}</div>
                      <div className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
                        {entry.count} aktiv
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[var(--text-muted)]">
                    Für die aktuelle Filterung sind keine internen Piloten aktiv.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium text-[var(--text-strong)]">7-Tage-Trend</div>
                <div className="flex gap-2 text-[11px]">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[var(--text-strong)]">
                    Klicks
                  </span>
                  <span className="rounded-full border border-black/10 bg-[var(--brand-accent-soft)] px-3 py-1 text-[var(--brand-accent)]">
                    Conversions
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-7">
                {trendDays.map((entry) => (
                  <div key={entry.key} className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                    <div className="text-[11px] text-[var(--text-muted)]">{entry.label}</div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                          <span>Klicks</span>
                          <span>{entry.clicks}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-panel)]">
                          <div
                            className="h-2 rounded-full bg-[var(--text-strong)]"
                            style={{ width: `${Math.max(8, (entry.clicks / maxTrendValue) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                          <span>Conv.</span>
                          <span>{entry.conversions}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-panel)]">
                          <div
                            className="h-2 rounded-full bg-[var(--brand-accent)]"
                            style={{ width: `${Math.max(8, (entry.conversions / maxTrendValue) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
            <div className="text-sm font-medium text-[var(--text-strong)]">Letzte Conversion-Signale</div>
            <div className="mt-4 space-y-3">
              {recentConversionSignals.length > 0 ? (
                recentConversionSignals.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-black/5 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-[var(--text-strong)]">
                          {entry.event_type}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {entry.route?.title ?? "Ohne Route"} ·{" "}
                          {entry.creator?.display_name ?? entry.creator?.username ?? "Ohne Creator"} ·{" "}
                          {entry.partner?.display_name ?? "Ohne Partner"}
                        </div>
                      </div>
                      <div className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        {formatDateTime(entry.occurred_at)}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {entry.surface ? (
                        <span className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-[var(--text-strong)]">
                          {entry.surface}
                        </span>
                      ) : null}
                      {typeof entry.metadata?.source === "string" ? (
                        <span className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-[var(--text-muted)]">
                          {entry.metadata.source}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[var(--text-muted)]">
                  Aktuell liegen noch keine Conversion-Signale wie `plan_save`, `share_activation` oder `route_copy` für die aktuelle Filterung vor.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Creator-Profil Rail KPIs"
          subtitle="Kleine Ops-Sicht auf die neue Featured-Route-Distribution auf Creator-Profilen."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "aktive Creator-Piloten", value: compactNumber(internalCreatorProfilePilots.filter((entry) => entry.isLive).length) },
              { label: "Klicks heute", value: compactNumber(creatorProfileClicksToday.length) },
              { label: "Klicks 7 Tage", value: compactNumber(creatorProfileClicks7d.length) },
              { label: "Creator mit Signalen", value: compactNumber(creatorProfileCreatorsTouched) },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="text-sm font-medium text-[var(--text-strong)]">Staerkste Creator-Profile</div>
              <div className="mt-4 space-y-3">
                {creatorProfileTopCreators.length > 0 ? (
                  creatorProfileTopCreators.map((entry) => (
                    <div
                      key={entry.creatorId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3"
                    >
                      <div>
                        <div className="font-medium text-[var(--text-strong)]">
                          {entry.creator?.display_name ?? entry.creator?.username ?? "Unbekannter Creator"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          @{entry.creator?.username ?? "ohne-handle"}
                        </div>
                      </div>
                      <div className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
                        {entry.count} Klicks
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[var(--text-muted)]">
                    Noch keine Creator-Profil-Klicksignale vorhanden.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium text-[var(--text-strong)]">Letzte Featured-Route-Klicks</div>
                <Link
                  href={buildAdminFilterHref(activeFilters, { scope: "internal", surface: "creator_profile", signal: "clicks_today" })}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                >
                  Creator-Profil Klicks heute
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {creatorProfileRecentSignals.length > 0 ? (
                  creatorProfileRecentSignals.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-black/5 bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-medium text-[var(--text-strong)]">
                            {entry.route?.title ?? "Featured Route"}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {entry.creator?.display_name ?? entry.creator?.username ?? "Unbekannter Creator"} ·{" "}
                            {entry.partner?.display_name ?? "Unbekannter Partner"}
                          </div>
                        </div>
                        <div className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                          {formatDateTime(entry.occurred_at)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {entry.route?.slug ? (
                          <span className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-[var(--text-strong)]">
                            /routes/{entry.route.slug}
                          </span>
                        ) : null}
                        {typeof entry.metadata?.source === "string" ? (
                          <span className="rounded-full border border-black/10 bg-[var(--bg-panel)] px-3 py-1 text-[var(--text-muted)]">
                            {entry.metadata.source}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[var(--text-muted)]">
                    Noch keine Featured-Route-Klicks auf Creator-Profilen.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Filter"
          subtitle="Damit ihr interne Piloten, Surface-spezifische Rails und frische Klicksignale schneller lesen koennt."
        >
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildAdminFilterHref(activeFilters, { scope: "all", signal: "all", surface: "all" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                scopeFilter === "all" && signalFilter === "all" && surfaceFilter === "all"
                  ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                  : "border-black/10 bg-white text-[var(--text-strong)]"
              }`}
            >
              Alle Daten
            </Link>
            <Link
              href={buildAdminFilterHref(activeFilters, { scope: "internal" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                scopeFilter === "internal"
                  ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]"
                  : "border-black/10 bg-white text-[var(--text-strong)]"
              }`}
            >
              Nur interne Piloten
            </Link>
            <Link
              href={buildAdminFilterHref(activeFilters, { signal: "clicks_today" })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                signalFilter === "clicks_today"
                  ? "border-[var(--state-success)] bg-[var(--brand-accent-cloud)] text-[var(--state-success)]"
                  : "border-black/10 bg-white text-[var(--text-strong)]"
              }`}
            >
              Heutige Klicks
            </Link>
            {["explore", "planner", "shared_plan", "route_detail", "creator_profile"].map((surface) => (
              <Link
                key={surface}
                href={buildAdminFilterHref(activeFilters, { surface })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  surfaceFilter === surface
                    ? "border-[var(--state-warning)] bg-[var(--brand-accent-cloud)] text-[var(--state-warning)]"
                    : "border-black/10 bg-white text-[var(--text-strong)]"
                }`}
              >
                Surface: {surface}
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="Interne Explore-Piloten"
          subtitle="Hier koennt ihr die beiden echten Explore-Rails direkt an- und ausschalten."
        >
          {internalExplorePilots.length === 0 ? (
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
              Noch keine internen Explore-Piloten angelegt.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {internalExplorePilots.map(({ campaign, partner, product, assignment, slot, isLive }) => (
                <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner?.display_name ?? "Unbekannter Partner"} ·{" "}
                        {product?.display_name ?? campaign.campaign_type}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isLive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-amber-300 bg-amber-50 text-amber-950"
                      }`}
                    >
                      {isLive ? "Live intern aktiv" : "Intern pausiert"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Surface / Slot</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {slot ? `${slot.surface} · ${slot.slot_key}` : "Noch kein Slot"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">CTA</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {campaign.cta_label ?? "Kein CTA"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Kampagne</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">{campaign.status}</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Assignment</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {assignment?.status ?? "Keins"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {isLive ? (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "paused" }}
                        label="Pilot pausieren"
                        tone="warning"
                      />
                    ) : (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "active" }}
                        label="Pilot aktivieren"
                        tone="active"
                      />
                    )}
                    <Link
                      href="/explore?monetization=debug"
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                    >
                      Explore Debug
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Interne Planner-Piloten"
          subtitle="Hier steuert ihr die ersten Featured-Rails direkt im kaufnahen Planner-Kontext."
        >
          {internalPlannerPilots.length === 0 ? (
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
              Noch keine internen Planner-Piloten angelegt.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {internalPlannerPilots.map(({ campaign, partner, product, assignment, slot, isLive }) => (
                <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner?.display_name ?? "Unbekannter Partner"} ·{" "}
                        {product?.display_name ?? campaign.campaign_type}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isLive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-amber-300 bg-amber-50 text-amber-950"
                      }`}
                    >
                      {isLive ? "Live intern aktiv" : "Intern pausiert"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Surface / Slot</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {slot ? `${slot.surface} · ${slot.slot_key}` : "Noch kein Slot"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">CTA</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {campaign.cta_label ?? "Kein CTA"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Kampagne</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">{campaign.status}</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Assignment</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {assignment?.status ?? "Keins"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {isLive ? (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "paused" }}
                        label="Pilot pausieren"
                        tone="warning"
                      />
                    ) : (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "active" }}
                        label="Pilot aktivieren"
                        tone="active"
                      />
                    )}
                    <Link
                      href="/planner?monetization=debug"
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                    >
                      Planner Debug
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Interne Share-Piloten"
          subtitle="Kontextnahe Partner-CTAs auf geteilten Plaenen, weiterhin nur intern sichtbar und steuerbar."
        >
          {internalSharePilots.length === 0 ? (
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
              Noch keine internen Share-Piloten angelegt.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {internalSharePilots.map(({ campaign, partner, product, assignment, slot, isLive }) => (
                <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner?.display_name ?? "Unbekannter Partner"} ·{" "}
                        {product?.display_name ?? campaign.campaign_type}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isLive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-amber-300 bg-amber-50 text-amber-950"
                      }`}
                    >
                      {isLive ? "Live intern aktiv" : "Intern pausiert"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Surface / Slot</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {slot ? `${slot.surface} · ${slot.slot_key}` : "Noch kein Slot"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">CTA</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {campaign.cta_label ?? "Kein CTA"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Kampagne</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">{campaign.status}</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Assignment</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {assignment?.status ?? "Keins"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {isLive ? (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "paused" }}
                        label="Pilot pausieren"
                        tone="warning"
                      />
                    ) : (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "active" }}
                        label="Pilot aktivieren"
                        tone="active"
                      />
                    )}
                    <Link
                      href={buildAdminFilterHref(activeFilters, { surface: "shared_plan" })}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                    >
                      Shared Debug
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Interne Route-Detail-Piloten"
          subtitle="Distribution fuer Creator- oder Brand-Routen direkt auf der Detailseite, intern testbar und sauber getrennt vom organischen Inhalt."
        >
          {internalRoutePilots.length === 0 ? (
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
              Noch keine internen Route-Detail-Piloten angelegt.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {internalRoutePilots.map(({ campaign, partner, product, assignment, slot, isLive }) => (
                <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner?.display_name ?? "Unbekannter Partner"} ·{" "}
                        {product?.display_name ?? campaign.campaign_type}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isLive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-amber-300 bg-amber-50 text-amber-950"
                      }`}
                    >
                      {isLive ? "Live intern aktiv" : "Intern pausiert"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Surface / Slot</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {slot ? `${slot.surface} · ${slot.slot_key}` : "Noch kein Slot"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">CTA</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {campaign.cta_label ?? "Kein CTA"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Kampagne</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">{campaign.status}</div>
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                      <div className="text-[var(--text-muted)]">Assignment</div>
                      <div className="mt-1 font-medium text-[var(--text-strong)]">
                        {assignment?.status ?? "Keins"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {isLive ? (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "paused" }}
                        label="Pilot pausieren"
                        tone="warning"
                      />
                    ) : (
                      <AdminEntityToggle
                        entity="campaign"
                        id={campaign.id}
                        patch={{ status: "active" }}
                        label="Pilot aktivieren"
                        tone="active"
                      />
                    )}
                    <Link
                      href={buildAdminFilterHref(activeFilters, { surface: "route_detail" })}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                    >
                      Route-Detail Debug
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Interne Creator-Profil-Piloten"
          subtitle="Featured Routes auf Creator- und oeffentlichen Profilseiten, intern steuerbar und getrennt vom organischen Profil-Feed."
        >
          {internalCreatorProfilePilots.length === 0 ? (
            <div className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
              Noch keine internen Creator-Profil-Piloten angelegt.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {internalCreatorProfilePilots.map(
                ({ campaign, partner, product, assignment, slot, targetCreator, isLive }) => (
                  <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">
                          {partner?.display_name ?? "Unbekannter Partner"} ·{" "}
                          {product?.display_name ?? campaign.campaign_type}
                        </div>
                        {targetCreator ? (
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Zielprofil: {targetCreator.display_name ?? targetCreator.username ?? "Unbekannt"}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs ${
                          isLive
                            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                            : "border-amber-300 bg-amber-50 text-amber-950"
                        }`}
                      >
                        {isLive ? "Live intern aktiv" : "Intern pausiert"}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                        <div className="text-[var(--text-muted)]">Surface / Slot</div>
                        <div className="mt-1 font-medium text-[var(--text-strong)]">
                          {slot ? `${slot.surface} · ${slot.slot_key}` : "Noch kein Slot"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                        <div className="text-[var(--text-muted)]">CTA</div>
                        <div className="mt-1 font-medium text-[var(--text-strong)]">
                          {campaign.cta_label ?? "Kein CTA"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                        <div className="text-[var(--text-muted)]">Kampagne</div>
                        <div className="mt-1 font-medium text-[var(--text-strong)]">{campaign.status}</div>
                      </div>
                      <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                        <div className="text-[var(--text-muted)]">Assignment</div>
                        <div className="mt-1 font-medium text-[var(--text-strong)]">
                          {assignment?.status ?? "Keins"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 flex-wrap">
                      {isLive ? (
                        <AdminEntityToggle
                          entity="campaign"
                          id={campaign.id}
                          patch={{ status: "paused" }}
                          label="Pilot pausieren"
                          tone="warning"
                        />
                      ) : (
                        <AdminEntityToggle
                          entity="campaign"
                          id={campaign.id}
                          patch={{ status: "active" }}
                          label="Pilot aktivieren"
                          tone="active"
                        />
                      )}
                      <Link
                        href={buildAdminFilterHref(activeFilters, { surface: "creator_profile" })}
                        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)]"
                      >
                        Creator-Profil Debug
                      </Link>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Section>

        <Section title="Sponsored Slots" subtitle="Getrennte Premium-Flaechen, zunaechst intern testbar.">
          <div className="space-y-4">
            {snapshot.slots.map((slot) => {
              const assignments = snapshot.assignments.filter((assignment) => assignment.slot_id === slot.id);
              return (
                <div key={slot.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{slot.slot_key}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {slot.surface} · {slot.slot_type} · {slot.disclosure_label}
                      </div>
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
                        {assignments.length} Assignments · max {slot.max_positions} · Modus {slot.ranking_mode}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs">
                        Status: {slot.status}
                      </span>
                      {slot.status !== "active" ? (
                        <AdminEntityToggle
                          entity="slot"
                          id={slot.id}
                          patch={{ status: "active" }}
                          label="Aktivieren"
                          tone="active"
                        />
                      ) : (
                        <AdminEntityToggle
                          entity="slot"
                          id={slot.id}
                          patch={{ status: "inactive" }}
                          label="Deaktivieren"
                          tone="warning"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Partner & Kampagnen" subtitle="Partnerprofile, Sichtbarkeitsstufen und laufende Kampagnen.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              {snapshot.partners.map((partner) => (
                <div key={partner.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{partner.display_name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner.partner_type} · {partner.visibility_tier} · {partner.primary_city_slug ?? "ohne Stadt"}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                        {partner.status}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                        Billing: {partner.billing_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {visibleCampaigns.map((campaign) => {
                const partner = partnerById.get(campaign.partner_profile_id) ?? null;
                const assignment = snapshot.assignments.find((entry) => entry.campaign_id === campaign.id) ?? null;
                const slot = assignment ? slotById.get(assignment.slot_id) ?? null : null;
                const isInternalExplorePilot = campaign.name.startsWith("Internal Featured Explore Pilot:");
                const isInternalPlannerPilot = campaign.name.startsWith("Internal Featured Planner Pilot:");
                const isInternalSharePilot = campaign.name.startsWith("Internal Featured Shared Plan Pilot:");
                const isInternalRoutePilot = campaign.name.startsWith("Internal Featured Route Detail Pilot:");
                const isInternalCreatorProfilePilot = campaign.name.startsWith("Internal Featured Creator Profile Pilot:");
                const isInternalPilot =
                  isInternalExplorePilot ||
                  isInternalPlannerPilot ||
                  isInternalSharePilot ||
                  isInternalRoutePilot ||
                  isInternalCreatorProfilePilot;
                const isPilotLive = campaign.status === "active" && assignment?.status === "active";

                return (
                  <div key={campaign.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-lg font-semibold text-[var(--text-strong)]">{campaign.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">
                          {partner?.display_name ?? "Unbekannter Partner"} · {campaign.campaign_type}
                        </div>
                        <div className="mt-2 text-xs text-[var(--text-muted)]">
                          {campaign.city_slug ?? "ohne Stadt"} · {formatDateTime(campaign.starts_at)} bis{" "}
                          {formatDateTime(campaign.ends_at)}
                        </div>
                        {assignment ? (
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Slot: {slot?.slot_key ?? "unbekannt"} · Assignment: {assignment.status}
                          </div>
                        ) : null}
                        {isInternalPilot ? (
                          <div className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-950">
                            {isPilotLive
                              ? isInternalPlannerPilot
                                ? "Interner Planner-Pilot aktiv"
                                : isInternalSharePilot
                                  ? "Interner Share-Pilot aktiv"
                                  : isInternalRoutePilot
                                    ? "Interner Route-Detail-Pilot aktiv"
                                    : isInternalCreatorProfilePilot
                                      ? "Interner Creator-Profil-Pilot aktiv"
                                  : "Interner Explore-Pilot aktiv"
                              : isInternalPlannerPilot
                                ? "Interner Planner-Pilot pausiert"
                                : isInternalSharePilot
                                  ? "Interner Share-Pilot pausiert"
                                  : isInternalRoutePilot
                                    ? "Interner Route-Detail-Pilot pausiert"
                                    : isInternalCreatorProfilePilot
                                      ? "Interner Creator-Profil-Pilot pausiert"
                                : "Interner Explore-Pilot pausiert"}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs">
                          {campaign.status}
                        </span>
                        {campaign.status !== "active" ? (
                          <AdminEntityToggle
                            entity="campaign"
                            id={campaign.id}
                            patch={{ status: "active" }}
                            label="Aktivieren"
                            tone="active"
                          />
                        ) : (
                          <AdminEntityToggle
                            entity="campaign"
                            id={campaign.id}
                            patch={{ status: "paused" }}
                            label="Pausieren"
                            tone="warning"
                          />
                        )}
                        {isInternalPilot ? (
                          <Link
                            href={
                              isInternalPlannerPilot
                                ? "/planner?monetization=debug"
                                : isInternalSharePilot
                                  ? buildAdminFilterHref(activeFilters, { surface: "shared_plan" })
                                  : isInternalRoutePilot
                                    ? buildAdminFilterHref(activeFilters, { surface: "route_detail" })
                                    : isInternalCreatorProfilePilot
                                      ? buildAdminFilterHref(activeFilters, { surface: "creator_profile" })
                                : "/explore?monetization=debug"
                            }
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[var(--text-strong)]"
                          >
                            {isInternalPlannerPilot
                              ? "Planner Debug"
                              : isInternalSharePilot
                                ? "Shared Debug"
                                : isInternalRoutePilot
                                  ? "Route-Detail Debug"
                                  : isInternalCreatorProfilePilot
                                    ? "Creator-Profil Debug"
                                : "Explore Debug"}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Affiliate Links" subtitle="Transaktionsnahe CTA-Schicht für Events, Stops, Share- und Routenmomente.">
          <div className="space-y-4">
            {snapshot.affiliateLinks.map((link) => {
              const partner = link.partner_profile_id ? partnerById.get(link.partner_profile_id) ?? null : null;
              const product = link.product_id ? productById.get(link.product_id) ?? null : null;
              return (
                <div key={link.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 max-w-3xl">
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{link.provider_name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {partner?.display_name ?? "Kein Partner"} · {product?.display_name ?? "Ohne Produkt"} ·{" "}
                        {link.link_scope}
                      </div>
                      <div className="mt-2 break-all text-xs text-[var(--text-muted)]">{link.destination_url}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs">
                        {link.commission_model}
                      </span>
                      {link.is_active ? (
                        <AdminEntityToggle
                          entity="affiliate"
                          id={link.id}
                          patch={{ is_active: false }}
                          label="Deaktivieren"
                          tone="warning"
                        />
                      ) : (
                        <AdminEntityToggle
                          entity="affiliate"
                          id={link.id}
                          patch={{ is_active: true }}
                          label="Aktivieren"
                          tone="active"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Revenue-Produkte & Entitlements" subtitle="Welche Rails schon intern aktivierbar sind und welche noch bewusst auf off stehen.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              {snapshot.products.map((product) => (
                <div key={product.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{product.display_name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {product.revenue_layer} · {product.horizon} · {product.billing_model}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs">
                        {product.status}
                      </span>
                      {product.status !== "active" ? (
                        <AdminEntityToggle
                          entity="product"
                          id={product.id}
                          patch={{ status: "active" }}
                          label="Aktivieren"
                          tone="active"
                        />
                      ) : (
                        <AdminEntityToggle
                          entity="product"
                          id={product.id}
                          patch={{ status: "draft" }}
                          label="Zurück auf Draft"
                          tone="warning"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {snapshot.entitlements.map((entitlement) => (
                <div key={entitlement.entitlement_key} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                  <div className="text-lg font-semibold text-[var(--text-strong)]">{entitlement.entitlement_key}</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    {entitlement.layer} · Default: {entitlement.default_state}
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-muted)]">{entitlement.description}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Creator & Profilsignale" subtitle="Wer bereits Reichweite, Kopien und Reward-Vorbereitung erzeugt.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.creators.slice(0, 12).map((creator) => (
              <div key={creator.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5">
                <div className="text-lg font-semibold text-[var(--text-strong)]">
                  {creator.display_name ?? creator.username ?? "Unbekanntes Profil"}
                </div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {creator.creator_type ?? "user"} · @{creator.username ?? "ohne-handle"}
                </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                    <div className="text-[var(--text-muted)]">Route-Copies</div>
                    <div className="mt-1 font-medium text-[var(--text-strong)]">
                      {routeCopyCountByCreator[creator.id] ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white px-3 py-3">
                    <div className="text-[var(--text-muted)]">Rewards</div>
                    <div className="mt-1 font-medium text-[var(--text-strong)]">
                      {rewardCountByCreator[creator.id] ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Attribution & Creator Rewards" subtitle="Die letzten Signale aus Planner, Share, Route und CTA-Momenten.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              {filteredAttribution.slice(0, 20).map((event) => {
                const partner = event.partner_profile_id ? partnerById.get(event.partner_profile_id) ?? null : null;
                const creator = event.creator_profile_id ? creatorById.get(event.creator_profile_id) ?? null : null;
                return (
                  <div key={event.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm">
                    <div className="font-medium text-[var(--text-strong)]">
                      {event.event_type} · {event.surface ?? "—"}
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">{formatDateTime(event.occurred_at)}</div>
                    {partner ? <div className="mt-2 text-[var(--text-muted)]">Partner: {partner.display_name}</div> : null}
                    {creator ? (
                      <div className="mt-1 text-[var(--text-muted)]">
                        Creator: {creator.display_name ?? creator.username ?? "Unbekannt"}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              {snapshot.rewards.slice(0, 20).map((reward) => {
                const creator = creatorById.get(reward.creator_profile_id) ?? null;
                return (
                  <div key={reward.id} className="rounded-[24px] border border-black/5 bg-[var(--bg-panel)] p-5 text-sm">
                    <div className="font-medium text-[var(--text-strong)]">
                      {reward.reward_type} · {reward.status}
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">
                      {reward.reward_value} {reward.reward_unit} · {reward.source_type}
                    </div>
                    {creator ? (
                      <div className="mt-2 text-[var(--text-muted)]">
                        Creator: {creator.display_name ?? creator.username ?? "Unbekannt"}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[var(--text-muted)]">{formatDateTime(reward.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
