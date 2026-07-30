"use client";

import { useEffect, useMemo, useState } from "react";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import { getMonetizationProducts, getSponsoredSlotDefinition } from "@/lib/monetization/debug";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import type { MonetizationProductKey, SponsoredSlotKey } from "@/lib/monetization/types";

type LiveSlotAssignment = {
  id: string;
  campaignId: string | null;
  status: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  campaignName: string;
  campaignStatus: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  partnerName: string | null;
  partnerSlug: string | null;
  partnerProfileId: string | null;
  citySlug: string | null;
  targetRouteId: string | null;
  targetLocationId: string | null;
  targetEventId: string | null;
  targetCreatorProfileId: string | null;
};

type LiveSlotStatus = {
  slotKey: SponsoredSlotKey;
  surface: string;
  status: string;
  disclosureLabel: string;
  assignmentCount: number;
  activeAssignmentCount: number;
  assignments: LiveSlotAssignment[];
};

type DebugResponse = {
  slotStatuses: LiveSlotStatus[];
};

type Props = {
  enabled: boolean;
  slotKey: SponsoredSlotKey;
  title: string;
  description: string;
  productKeys?: MonetizationProductKey[];
  previewItems?: string[];
  citySlug?: string | null;
  routeId?: string | null;
  creatorProfileId?: string | null;
  livePreview?: boolean;
  ctaSource?: string;
  className?: string;
};

export default function InternalMonetizationSlot({
  enabled,
  slotKey,
  title,
  description,
  productKeys = [],
  previewItems = [],
  citySlug = null,
  routeId = null,
  creatorProfileId = null,
  livePreview = false,
  ctaSource = "internal_featured_visibility_pilot",
  className = "",
}: Props) {
  const slot = getSponsoredSlotDefinition(slotKey);
  const slotSurface = slot?.surface ?? null;
  const products = getMonetizationProducts(productKeys);
  const [liveStatus, setLiveStatus] = useState<LiveSlotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !livePreview || !slotSurface) return;

    let active = true;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        params.set("surface", slotSurface);
        if (citySlug) params.set("citySlug", citySlug);
        if (routeId) params.set("routeId", routeId);
        if (creatorProfileId) params.set("creatorProfileId", creatorProfileId);

        const resp = await fetch(`/api/monetization/debug?${params.toString()}`, {
          cache: "no-store",
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `Debug request failed (${resp.status})`);
        }

        const data = (await resp.json()) as DebugResponse;
        if (!active) return;
        setLiveStatus(data.slotStatuses.find((entry) => entry.slotKey === slotKey) ?? null);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Live-Slotdaten konnten nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [citySlug, creatorProfileId, enabled, livePreview, routeId, slotKey, slotSurface]);

  const activeAssignments = useMemo(
    () =>
      liveStatus?.status === "active"
        ? liveStatus.assignments.filter(
            (assignment) => assignment.status === "active" && assignment.campaignStatus === "active"
          )
        : [],
    [liveStatus]
  );

  // Fire impression events for each active partner assignment shown
  useEffect(() => {
    if (!livePreview || activeAssignments.length === 0) return;
    activeAssignments.forEach((assignment) => {
      void trackMonetizationEvent({
        eventType: "impression",
        partnerProfileId: assignment.partnerProfileId,
        campaignId: assignment.campaignId,
        slotKey: slotKey,
        citySlug: assignment.citySlug ?? citySlug ?? null,
        surface: slot?.surface ?? null,
        routeId: assignment.targetRouteId ?? routeId ?? null,
        creatorProfileId: assignment.targetCreatorProfileId ?? creatorProfileId ?? null,
        onceKey: `impression:${slotKey}:${assignment.id}`,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssignments.length, slotKey]);

  if (!enabled || !slot) return null;

  return (
    <div
      className={`rounded-[28px] border border-dashed border-amber-300 bg-amber-50/80 p-5 text-sm text-amber-950 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700">
            Interner Monetization-Slot
          </div>
          <div className="mt-2 text-lg font-semibold">{title}</div>
          <p className="mt-2 max-w-3xl leading-relaxed text-amber-900/90">{description}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white/80 px-3 py-2 text-xs text-amber-900">
          <div>Status: {slot.defaultStatus}</div>
          <div>Disclosure: {slot.disclosureLabel}</div>
          <div>Max Slots: {slot.maxPositions}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
          Key: {slot.key}
        </span>
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
          Surface: {slot.surface}
        </span>
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
          Typ: {slot.slotType}
        </span>
      </div>

      {previewItems.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Gedachte Inhalte
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {previewItems.map((item) => (
              <span key={item} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Spaetere Revenue-Produkte
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {products.map((product) => (
              <span key={product.key} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs">
                {product.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {livePreview ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-white/85 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Aktiver interner Pilot
            </div>
            {citySlug ? (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-900">
                Fokus: {citySlug}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 text-xs text-amber-900/80">Live-Slotdaten werden geladen...</div>
          ) : loadError ? (
            <div className="mt-3 rounded-xl pd24-status-error px-3 py-2 text-xs">
              {loadError}
            </div>
          ) : activeAssignments.length > 0 ? (
            <div className="mt-3 space-y-3">
              {activeAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-amber-950">
                        {assignment.partnerName ?? "Unbekannter Partner"}
                      </div>
                      <div className="mt-1 text-xs text-amber-900/80">
                        {assignment.campaignName}
                      </div>
                    </div>
                    <div className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] text-amber-900">
                      Prioritaet {assignment.priority}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-amber-900/80">
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                      Status: {assignment.campaignStatus ?? assignment.status}
                    </span>
                    {assignment.citySlug ? (
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                        Stadt: {assignment.citySlug}
                      </span>
                    ) : null}
                    {assignment.targetLocationId ? (
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                        Target: Location
                      </span>
                    ) : null}
                    {assignment.targetEventId ? (
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                        Target: Event
                      </span>
                    ) : null}
                    {assignment.targetRouteId ? (
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                        Target: Route
                      </span>
                    ) : null}
                    {assignment.targetCreatorProfileId ? (
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                        Target: Creator
                      </span>
                    ) : null}
                  </div>

                  {assignment.ctaUrl ? (
                    <div className="mt-3">
                      <MonetizedExternalLink
                        href={assignment.ctaUrl}
                        targetUrl={assignment.ctaUrl}
                        eventType="click"
                        surface={slot.surface}
                        citySlug={assignment.citySlug ?? citySlug ?? null}
                        slotKey={slot.key}
                        partnerProfileId={assignment.partnerProfileId}
                        campaignId={assignment.campaignId}
                        routeId={assignment.targetRouteId}
                        locationId={assignment.targetLocationId}
                        plannerEventId={assignment.targetEventId}
                        creatorProfileId={assignment.targetCreatorProfileId}
                        label={assignment.partnerName ?? assignment.campaignName}
                        source={ctaSource}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-amber-900 bg-amber-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-amber-950"
                      >
                        {assignment.ctaLabel ?? "Partner ansehen"}
                      </MonetizedExternalLink>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-amber-900/80">
              Aktuell ist auf dieser Flaeche noch kein echter Partner-Pilot aktiv.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
