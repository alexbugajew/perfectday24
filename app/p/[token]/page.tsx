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
    return new Date(d).toLocaleString();
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
  return `${n.toFixed(1)} km`;
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
      <main className="p-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">PerfectDay24</h1>
            <p className="text-gray-600">Share-Link</p>
          </div>
          <Link href="/" className="px-3 py-2 rounded border text-sm">
            Zur Startseite
          </Link>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="font-semibold mb-1">Token fehlt</div>
          <div className="text-sm text-gray-600">
            Bitte öffne einen Link wie <code>/p/&lt;token&gt;</code>.
          </div>
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

  if (rpcResp.error || !plan) {
    return (
      <main className="p-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">PerfectDay24</h1>
            <p className="text-gray-600">Share-Link</p>
          </div>
          <Link href="/" className="px-3 py-2 rounded border text-sm">
            Zur Startseite
          </Link>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="font-semibold mb-1">Plan nicht gefunden</div>
          <div className="text-sm text-gray-600">
            Dieser Link ist ungültig oder der Plan wurde nicht (mehr) geteilt.
          </div>

          <div className="mt-4 text-xs text-gray-600 whitespace-pre-wrap">
            <div className="font-semibold mb-1">Debug</div>
            <div>token: {token}</div>
            <div className="mt-2 font-semibold">rpc error:</div>
            <div>{rpcResp.error ? JSON.stringify(rpcResp.error, null, 2) : "—"}</div>
            <div className="mt-2 font-semibold">rpc data:</div>
            <div>{rpcDataRaw ? JSON.stringify(rpcDataRaw, null, 2) : "—"}</div>
          </div>
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
    <main className="p-10 max-w-4xl mx-auto">
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
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-1">PerfectDay24 🚀</h1>
          <p className="text-gray-600">Geteilter Plan • ohne Login sichtbar</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" className="px-3 py-2 rounded border text-sm">
            Zur Startseite
          </Link>
        </div>
      </div>

      <div className="p-5 border rounded-lg mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-2xl font-semibold">{plan.title || "Untitled Plan"}</div>
            <div className="text-xs text-gray-500 mt-1">
              Erstellt: {formatDate(plan.created_at)} • Sort: {plan.sort_mode} • Level:{" "}
              {plan.active_level || "n/a"}
            </div>

            <div className="mt-3 text-sm text-gray-700">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div>
                  <span className="text-gray-500">Radius:</span> {plan.radius_km} km
                  {plan.effective_radius_km != null ? ` (effektiv: ${plan.effective_radius_km} km)` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <CopyPlanButton
              plan={planForCopy}
              sourcePlanId={plan.id}
              citySlug={plan.filters?.citySlug ?? null}
            />
            {chatPrefillHref ? (
              <Link href={chatPrefillHref} className="px-3 py-2 rounded border text-sm">
                Im Chat weitergeben
              </Link>
            ) : null}
          </div>
        </div>

        {sharedChoiceSummary.length ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold">Gemeinsame Wahl</div>
              {shareMoment ? (
                <span
                  className={`rounded-full border bg-white px-2 py-1 text-[11px] font-medium ${
                    shareMoment.tone === "emerald"
                      ? "border-emerald-300 text-emerald-900"
                      : shareMoment.tone === "amber"
                        ? "border-amber-300 text-amber-900"
                        : "border-sky-300 text-sky-900"
                  }`}
                >
                  {shareMoment.label}
                </span>
              ) : null}
              {plan.filters?.finalGroupPlan ? (
                <span className="rounded-full border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-900">
                  {plan.filters?.finalGroupStatusLabel || plan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan"}
                </span>
              ) : null}
            </div>
            <div className="mt-2 space-y-1">
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
          <div className="mt-4 p-4 border rounded-lg text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {plan.ai_description}
          </div>
        ) : null}
      </div>

      {monetizationDebug ? (
        <div className="mb-6 space-y-4">
          <InternalMonetizationSlot
            enabled={monetizationDebug}
            slotKey="shared_plan_partner_cta"
            title="Shared Plan: Partner CTA"
            description="Interner Pilot fuer einen kontextnahen Partner-CTA auf geteilten Plaenen. Hier pruefen wir, ob ein klar markierter Zusatzimpuls nach Gruppenentscheidung und Planuebernahme produktvertraeglich bleibt."
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

      <div className="p-4 border rounded-lg mb-6 space-y-3">
        <div>
          <div className="font-semibold">Route</div>
          <div className="text-xs text-gray-600">
            Startpunkt: {plan.filters?.startPoint?.label || "—"}
          </div>
        </div>

        {mapStops.length >= 2 ? (
          <PlanMapClient stops={mapStops} profile="foot" height={360} />
        ) : (
          <div className="text-sm text-gray-600">
            Für die Karte fehlen ausreichend Koordinaten.
          </div>
        )}
      </div>

      <h2 className="text-2xl font-semibold mb-3">Stops</h2>

      {slots.length === 0 ? (
        <div className="p-4 border rounded-lg text-sm text-gray-700">Keine Stops gespeichert.</div>
      ) : (
        <div className="space-y-4 mb-10">
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
            const distText = kmText(
              loc?.distanceKm ?? loc?.distance_km ?? loc?.distanceFromOriginKm ?? null
            );

            return (
              <div key={s?.index ?? s?.slot ?? idx} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-bold text-lg">{mapSlotTitle(s)}</div>
                      {mapSlotSubtitle(s) ? (
                        <span className="text-xs px-2 py-1 rounded border text-gray-700">
                          {mapSlotSubtitle(s)}
                        </span>
                      ) : null}
                    </div>

                    {loc ? (
                      <>
                        <div className="mt-2 font-semibold">{name || "Unbenannte Location"}</div>
                        <div className="text-gray-700">{type}</div>

                        <div className="text-xs text-gray-500 mt-1">
                          {distText ? <>Distanz: {distText}</> : null}
                          {typeof dur === "number" ? <> {distText ? " • " : ""}Dauer: {dur} Min</> : null}
                          {typeof travel === "number" ? <> • Weg: ~{travel} Min</> : null}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-gray-600">—</div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {targetUrl ? (
                      <MonetizedExternalLink
                        href={targetUrl}
                        targetUrl={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded border text-sm"
                        planId={plan.id}
                        locationId={typeof loc?.id === "string" ? loc.id : null}
                        partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                        affiliateLinkId={affiliateMatch?.id ?? null}
                        citySlug={plan.filters?.citySlug ?? null}
                        surface="shared_plan_stop"
                        label={name || mapSlotTitle(s)}
                        source={affiliateMatch ? "shared_plan_affiliate_cta" : "shared_plan_stop_cta"}
                      >
                        {affiliateMatch ? `${affiliateMatch.providerName} oeffnen` : "Reservieren"}
                      </MonetizedExternalLink>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 border rounded-lg text-sm text-gray-700">
        <div className="font-semibold mb-1">Tipp</div>
        <div>
          Wenn du den Plan übernimmst, kannst du ihn auf der Startseite weiter anpassen (Vorlieben, Umkreis, Stops tauschen,
          KI-Text neu erzeugen).
        </div>
      </div>
    </main>
  );
}
