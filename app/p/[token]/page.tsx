// app/p/[token]/page.tsx
import Link from "next/link";
import CopyPlanButton from "./CopyPlanButton";
import SharedPlanChoicePanel from "./SharedPlanChoicePanel";
import SharedPlanEditPanel from "./SharedPlanEditPanel";
import { createClient } from "@supabase/supabase-js";
import PlanMapClient from "@/components/PlanMapClient";
import InternalMonetizationSlot from "@/components/monetization/InternalMonetizationSlot";
import MonetizationDebugPanel from "@/components/monetization/MonetizationDebugPanel";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import TrackOnMount from "@/components/monetization/TrackOnMount";
import TrackEventOnMount from "@/components/analytics/TrackEventOnMount";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import { resolvePublicAffiliateLinks } from "@/lib/monetization/public-affiliate-server";


type PublicPlan = {
  id: string;
  title: string | null;
  created_at: string;
  filters: any;
  radius_km: number;
  effective_radius_km: number | null;
  sort_mode: string;
  active_level: string | null;
  slots: any;
  share_token: string | null;
  ai_description?: string | null;
};

function normStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function mapSlotTitle(s: any) {
  const label = normStr(s?.label);
  if (label) return label;
  const idx = s?.index;
  if (typeof idx === "number") return `Stop ${idx}`;
  const slot = normStr(s?.slot);
  return slot ? slot : "Stop";
}

function mapSlotSubtitle(s: any) {
  return normStr(s?.hint) || "";
}

function getLocationFromSlot(s: any) {
  return s?.location ?? s?.item ?? null;
}

function kmText(v: any) {
  const n = typeof v === "number" ? v : v == null ? null : Number(v);
  if (n == null || !Number.isFinite(n)) return "";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function buildMapStops(plan: PublicPlan | null) {
  if (!plan) return [];

  const pts: Array<{ label: string; name: string; lat: number; lng: number }> = [];

  const start = plan.filters?.startPoint;
  if (start?.lat != null && start?.lng != null) {
    pts.push({
      label: "Start",
      name: start.label || "Startpunkt",
      lat: Number(start.lat),
      lng: Number(start.lng),
    });
  }

  const slots = Array.isArray(plan.slots) ? plan.slots : [];
  for (const s of slots) {
    const loc = getLocationFromSlot(s);
    if (loc?.lat != null && loc?.lng != null) {
      pts.push({
        label: mapSlotTitle(s),
        name: normStr(loc?.name) || "Location",
        lat: Number(loc.lat),
        lng: Number(loc.lng),
      });
    }
  }

  return pts;
}

function buildSharedChoiceSummary(filters: any) {
  const lines: string[] = [];
  if (filters?.pinnedVariantLabel) {
    lines.push(`${filters?.groupChoiceLabel || "Unsere Wahl"}: ${filters.pinnedVariantLabel}`);
  }
  if (
    typeof filters?.leadingVariantVotes === "number" &&
    filters.leadingVariantVotes > 0 &&
    filters?.leadingVariantLabel
  ) {
    lines.push(`${filters.leadingVariantVotes} Stimmen für ${filters.leadingVariantLabel}`);
  }
  return lines;
}

function deriveShareMoment(count: number, expectedCount?: number | null) {
  const total = typeof expectedCount === "number" && expectedCount > 0 ? expectedCount : null;
  const majority = total ? Math.max(2, Math.ceil(total / 2)) : null;

  if (total && count >= total) {
    return { label: "Tag ist abgestimmt", tone: "emerald" } as const;
  }
  if (majority && count >= majority) {
    return { label: "Gruppenwahl bestätigt", tone: "emerald" } as const;
  }
  if (majority && majority - count === 1) {
    return { label: "Fast bestätigt", tone: "amber" } as const;
  }
  if (count > 0) {
    return { label: "Erste Zustimmung da", tone: "sky" } as const;
  }
  return null;
}

export default async function SharePlanPage(props: { params: any; searchParams?: any }) {
  const resolvedParams = await Promise.resolve(props.params);
  const resolvedSearchParams = await Promise.resolve(props.searchParams ?? {});
  const token = normStr(resolvedParams?.token);
  const monetizationDebug = shouldShowInternalMonetization(normStr(resolvedSearchParams?.monetization));

  if (!token) {
    return (
      <main className="pd24-page-standard px-4 pb-16 pt-6">
        <nav className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-[var(--text-strong)]">PerfectDay24</Link>
        </nav>
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="pd24-meta">Link ungültig</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Dieser Link funktioniert nicht.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Bitte frag die Person, die den Plan geteilt hat, nach dem richtigen Link.
          </p>
          <Link
            href="/planner"
            className="mt-4 pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Eigenen Plan erstellen
          </Link>
        </div>
      </main>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false },
  });

  const rpcResp = await supabase.rpc("public_plan_by_token", { p_token: token });
  const reactionResp = await supabase.rpc("public_plan_choice_reactions_by_token", { p_token: token });
  const editSuggestionResp = await supabase.rpc("public_plan_edit_suggestions_by_token", { p_token: token });

  const rpcDataRaw: any = rpcResp.data;
  const reactionRows = (reactionResp.data ?? []) as Array<{ voter_label: string; created_at: string }>;
  const editSuggestions = (editSuggestionResp.data ?? []) as Array<{
    id: string;
    author_label: string;
    message: string;
    created_at: string;
    resolved_at?: string | null;
  }>;
  const plan: PublicPlan | null = Array.isArray(rpcDataRaw)
    ? (rpcDataRaw[0] ?? null)
    : (rpcDataRaw ?? null);

  // Fetch-/Serverfehler ≠ "Link existiert nicht": bei transienten Fehlern
  // neutralen Retry-Zustand zeigen statt "nicht mehr aktiv" zu behaupten.
  if (rpcResp.error) {
    console.error("Geteilten Plan laden fehlgeschlagen", rpcResp.error);
    return (
      <main className="pd24-page-standard px-4 pb-16 pt-6">
        <nav className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-[var(--text-strong)]">PerfectDay24</Link>
        </nav>
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="pd24-meta">Gerade nicht erreichbar</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Der Plan konnte nicht geladen werden.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Das liegt vermutlich an einer kurzen Störung. Bitte versuche es gleich noch einmal.
          </p>
          <a
            href={`/p/${encodeURIComponent(token)}`}
            className="mt-4 pd24-btn pd24-btn-sm pd24-btn-secondary"
          >
            Erneut versuchen
          </a>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="pd24-page-standard px-4 pb-16 pt-6">
        <nav className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-[var(--text-strong)]">PerfectDay24</Link>
        </nav>
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="pd24-meta">Plan nicht gefunden</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Dieser Link ist nicht mehr aktiv.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Der Plan wurde möglicherweise gelöscht oder der Link ist abgelaufen. Frag die Person, die ihn geteilt hat, nach einem neuen Link.
          </p>
          <Link
            href="/planner"
            className="mt-4 pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Eigenen Plan erstellen
          </Link>
        </div>
      </main>
    );
  }

  const planForCopy = {
    title: plan.title ?? null,
    filters: plan.filters ?? {},
    radius_km: plan.radius_km ?? 10,
    effective_radius_km: plan.effective_radius_km ?? null,
    sort_mode: plan.sort_mode ?? "match",
    active_level: plan.active_level ?? null,
    slots: plan.slots ?? [],
    ai_description: plan.ai_description ?? null,
  };

  const slots = Array.isArray(plan.slots) ? plan.slots : [];
  const shareLocationIds = Array.from(
    new Set(
      slots
        .map((slot) => {
          const loc = getLocationFromSlot(slot);
          return typeof loc?.id === "string" ? loc.id : null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );
  const affiliateResolution = await resolvePublicAffiliateLinks({
    locationIds: shareLocationIds,
  });
  const mapStops = buildMapStops(plan);
  const shareCitySlug = normStr(plan.filters?.citySlug) || null;
  const sharedChoiceSummary = buildSharedChoiceSummary(plan.filters ?? {});
  const shareExpectedCount = Array.from(
    new Set(
      Object.values((plan.filters?.variantVotes ?? {}) as Record<string, string[]>)
        .flatMap((voters) => (Array.isArray(voters) ? voters : []))
        .map((voter) => (typeof voter === "string" ? voter.trim() : ""))
        .filter(Boolean)
    )
  ).length;
  const chatPrefillHref = sharedChoiceSummary.length
    ? `/chat?prefill=${encodeURIComponent(sharedChoiceSummary.join("\n"))}`
    : null;
  const shareMoment = deriveShareMoment(reactionRows.length, shareExpectedCount || null);

  return (
    <main className="pd24-page-standard px-4 pb-16 pt-6">
      <TrackEventOnMount
        event="shared_plan_opened"
        props={{ occasion: plan.filters?.occasion ?? null }}
      />
      <TrackOnMount
        eventType="share_activation"
        planId={plan.id}
        citySlug={plan.filters?.citySlug ?? null}
        surface="shared_plan"
        onceKey={`share-activation:${plan.id}:${token}`}
        metadata={{
          token,
          pinnedVariantLabel: plan.filters?.pinnedVariantLabel ?? null,
        }}
      />

      {/* ── Nav ── */}
      <nav className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold text-[var(--text-strong)]">
          PerfectDay24
        </Link>
        <Link
          href="/planner"
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
        >
          Eigenen Plan erstellen →
        </Link>
      </nav>

      {/* ── Plan-Kopf ── */}
      <div className="mb-5 rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="pd24-meta">
              Geteilter Plan
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
              {plan.title || "Tagesplan"}
            </h1>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(plan.created_at)}</div>
          </div>
          <CopyPlanButton
            plan={planForCopy}
            sourcePlanId={plan.id}
            citySlug={plan.filters?.citySlug ?? null}
          />
        </div>

        {sharedChoiceSummary.length ? (
          <div className="mt-4 rounded-xl border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] p-4 text-sm text-[var(--text-strong)]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Gemeinsame Wahl</span>
              {shareMoment ? (
                <span
                  className={`rounded-full border bg-white px-2 py-1 text-[11px] font-medium ${
                    shareMoment.tone === "emerald"
                      ? "border-[var(--state-success)]/30 text-[var(--state-success)]"
                      : shareMoment.tone === "amber"
                        ? "border-[var(--state-warning)]/30 text-[var(--state-warning)]"
                        : "border-[var(--state-info)]/30 text-[var(--state-info)]"
                  }`}
                >
                  {shareMoment.label}
                </span>
              ) : null}
              {plan.filters?.finalGroupPlan ? (
                <span className="rounded-full border border-[var(--state-info)]/30 bg-white px-2 py-1 text-[11px] font-medium text-[var(--state-info)]">
                  {plan.filters?.finalGroupStatusLabel || plan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan"}
                </span>
              ) : null}
            </div>
            <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
              {sharedChoiceSummary.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ) : null}

        {plan.filters?.pinnedVariantLabel ? (
          <div className="mt-4">
            <SharedPlanChoicePanel
              token={token}
              choiceLabel={plan.filters.pinnedVariantLabel}
              initialReactions={reactionRows}
              expectedCount={shareExpectedCount || null}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <SharedPlanEditPanel
            token={token}
            initialSuggestions={editSuggestions}
          />
        </div>

        {plan.ai_description ? (
          <div className="mt-4 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4 text-sm leading-7 text-[var(--text-muted)] whitespace-pre-wrap">
            {plan.ai_description}
          </div>
        ) : null}
      </div>

      {/* ── Monetization Debug (intern) ── */}
      {monetizationDebug ? (
        <div className="mb-5 space-y-4">
          <InternalMonetizationSlot
            enabled={monetizationDebug}
            slotKey="shared_plan_partner_cta"
            title="Shared Plan: Partner CTA"
            description="Interner Pilot für einen kontextnahen Partner-CTA auf geteilten Plänen."
            productKeys={["sponsored_placement", "partner_basic", "partner_pro"]}
            previewItems={["Date-Dinner CTA", "Gruppen-Reservierung", "Kontextnaher Partnerimpuls"]}
            citySlug={shareCitySlug}
            livePreview
            ctaSource="internal_shared_plan_partner_pilot"
          />
          <MonetizationDebugPanel
            enabled={monetizationDebug}
            surface="shared_plan"
            citySlug={shareCitySlug}
            title="Shared Plan Monetization Debug"
          />
        </div>
      ) : null}

      {/* ── Karte ── */}
      {mapStops.length >= 2 ? (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
          <PlanMapClient stops={mapStops} profile="foot" height={360} />
        </div>
      ) : null}

      {/* ── Stops ── */}
      <div className="mb-6">
        <div className="mb-3 pd24-meta">
          Stops im Plan
        </div>
        {slots.length === 0 ? (
          <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-4 text-sm text-[var(--text-muted)]">
            Keine Stops gespeichert.
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((s: any, idx: number) => {
              const loc = getLocationFromSlot(s);
              const name = normStr(loc?.name);
              const type = normStr(loc?.type);
              const reservationUrl = normStr(loc?.reservation_url);
              const affiliateMatch =
                typeof loc?.id === "string" ? affiliateResolution.byLocationId[loc.id] ?? null : null;
              const targetUrl = affiliateMatch?.targetUrl ?? reservationUrl;
              const dur = s?.durationMin ?? s?.duration_min ?? null;
              const travel = s?.travelMinFromPrev ?? s?.travel_min_from_prev ?? null;

              return (
                <div
                  key={s?.index ?? s?.slot ?? idx}
                  className="rounded-xl border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--text-strong)] text-[11px] font-semibold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-base font-semibold text-[var(--text-strong)]">
                          {mapSlotTitle(s)}
                        </span>
                        {mapSlotSubtitle(s) ? (
                          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                            {mapSlotSubtitle(s)}
                          </span>
                        ) : null}
                      </div>
                      {loc ? (
                        <>
                          {name ? (
                            <div className="mt-1 text-sm text-[var(--text-muted)]">{name}</div>
                          ) : null}
                          {type ? (
                            <div className="mt-0.5 text-xs text-[var(--text-muted)]">{type}</div>
                          ) : null}
                          {(typeof dur === "number" || typeof travel === "number") ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {typeof dur === "number" ? (
                                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                                  ~{dur} Min
                                </span>
                              ) : null}
                              {typeof travel === "number" ? (
                                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                                  +{travel} Min Weg
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {targetUrl ? (
                      <MonetizedExternalLink
                        href={targetUrl}
                        targetUrl={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                        planId={plan.id}
                        locationId={typeof loc?.id === "string" ? loc.id : null}
                        partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                        affiliateLinkId={affiliateMatch?.id ?? null}
                        citySlug={plan.filters?.citySlug ?? null}
                        surface="shared_plan_stop"
                        label={name || mapSlotTitle(s)}
                        source={affiliateMatch ? "shared_plan_affiliate_cta" : "shared_plan_stop_cta"}
                      >
                        {affiliateMatch ? `${affiliateMatch.providerName} öffnen` : "Reservieren"}
                      </MonetizedExternalLink>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer CTA ── */}
      <div className="rounded-xl border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.9)] p-5">
        <div className="text-sm font-semibold text-[var(--text-strong)]">Plan übernehmen und anpassen</div>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
          Klick auf „Plan übernehmen“ lädt diesen Plan in deinen Planner — von dort kannst du Stops
          tauschen, das Timing anpassen und den Plan erneut teilen.
        </p>
        <CopyPlanButton
          plan={planForCopy}
          sourcePlanId={plan.id}
          citySlug={plan.filters?.citySlug ?? null}
        />
      </div>
    </main>
  );
}
