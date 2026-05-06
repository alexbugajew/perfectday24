"use client";

import { useEffect, useMemo, useState } from "react";

type AttributionSummaryRow = {
  eventType: string;
  count: number;
};

type RecentAttributionRow = {
  id: string;
  eventType: string;
  surface: string | null;
  citySlug: string | null;
  occurredAt: string;
  routeId: string | null;
  planId: string | null;
  partnerName: string | null;
  creatorName: string | null;
  metadata: Record<string, unknown> | null;
};

type RecentRewardRow = {
  id: string;
  rewardType: string;
  sourceType: string;
  status: string;
  rewardValue: number;
  rewardUnit: string;
  citySlug: string | null;
  routeId: string | null;
  creatorName: string | null;
  createdAt: string;
};

type SlotAssignmentRow = {
  id: string;
  status: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  campaignName: string;
  campaignStatus: string | null;
  partnerName: string | null;
  partnerSlug: string | null;
  citySlug: string | null;
};

type SlotStatusRow = {
  slotKey: string;
  surface: string;
  status: string;
  disclosureLabel: string;
  assignmentCount: number;
  activeAssignmentCount: number;
  assignments: SlotAssignmentRow[];
};

type DebugResponse = {
  attributionSummary: AttributionSummaryRow[];
  recentAttribution: RecentAttributionRow[];
  recentRewards: RecentRewardRow[];
  slotStatuses: SlotStatusRow[];
};

type Props = {
  enabled: boolean;
  surface: string;
  routeId?: string | null;
  creatorProfileId?: string | null;
  citySlug?: string | null;
  title?: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MonetizationDebugPanel({
  enabled,
  surface,
  routeId,
  creatorProfileId,
  citySlug,
  title = "Monetization Debug",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DebugResponse | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("surface", surface);
    if (routeId) params.set("routeId", routeId);
    if (creatorProfileId) params.set("creatorProfileId", creatorProfileId);
    if (citySlug) params.set("citySlug", citySlug);
    return params.toString();
  }, [surface, routeId, creatorProfileId, citySlug]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/monetization/debug?${query}`, {
          cache: "no-store",
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `Debug request failed (${resp.status})`);
        }

        const data = (await resp.json()) as DebugResponse;
        if (!active) return;
        setPayload(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Debugdaten konnten nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, query]);

  if (!enabled) return null;

  return (
    <section className="rounded-[28px] border border-sky-200 bg-sky-50/70 p-5 text-sm text-sky-950">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700">
            Interner Debugbereich
          </div>
          <h3 className="mt-2 text-lg font-semibold">{title}</h3>
          <p className="mt-2 max-w-3xl text-sky-900/85">
            Zeigt zuletzt erfasste Monetization-Signale, Creator-Rewards und Slot-Status für diese Fläche.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-white/80 px-3 py-2 text-xs">
          <div>Surface: {surface}</div>
          {citySlug ? <div>Stadt: {citySlug}</div> : null}
          {routeId ? <div>Route: {routeId.slice(0, 8)}…</div> : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sky-900">
          Debugdaten werden geladen…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          {error}
        </div>
      ) : payload ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Attribution
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.attributionSummary.length > 0 ? (
                payload.attributionSummary.map((row) => (
                  <span key={row.eventType} className="rounded-full border border-sky-200 px-3 py-1 text-xs">
                    {row.eventType}: {row.count}
                  </span>
                ))
              ) : (
                <span className="text-xs text-sky-900/70">Noch keine Events im Filter.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Slot-Status
            </div>
            <div className="mt-3 space-y-2">
              {payload.slotStatuses.length > 0 ? (
                payload.slotStatuses.map((slot) => (
                  <div key={slot.slotKey} className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs">
                    <div className="font-medium">{slot.slotKey}</div>
                    <div className="mt-1 text-sky-900/80">
                      {slot.status} · {slot.disclosureLabel}
                    </div>
                    <div className="mt-1 text-sky-900/70">
                      Assignments: {slot.assignmentCount} · aktiv: {slot.activeAssignmentCount}
                    </div>
                    {slot.assignments.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {slot.assignments.slice(0, 3).map((assignment) => (
                          <div key={assignment.id} className="rounded-lg border border-sky-100 bg-white/80 px-2 py-1">
                            <div className="font-medium">
                              {assignment.partnerName ?? "Unbekannter Partner"} · {assignment.campaignName}
                            </div>
                            <div className="mt-1 text-sky-900/70">
                              {assignment.status} · Priorität {assignment.priority}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-xs text-sky-900/70">Keine Slotdaten gefunden.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Creator Rewards
            </div>
            <div className="mt-3 space-y-2">
              {payload.recentRewards.length > 0 ? (
                payload.recentRewards.map((reward) => (
                  <div key={reward.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs">
                    <div className="font-medium">
                      {reward.rewardType} · {reward.status}
                    </div>
                    <div className="mt-1 text-sky-900/80">
                      {reward.rewardValue} {reward.rewardUnit} · {reward.sourceType}
                    </div>
                    {reward.creatorName ? (
                      <div className="mt-1 text-sky-900/70">Creator: {reward.creatorName}</div>
                    ) : null}
                    <div className="mt-1 text-sky-900/70">{formatDateTime(reward.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-sky-900/70">Noch keine Rewards im Filter.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-white p-4 lg:col-span-3">
            <div className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Letzte Signale
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {payload.recentAttribution.length > 0 ? (
                payload.recentAttribution.map((event) => (
                  <div key={event.id} className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 text-xs">
                    <div className="font-medium">
                      {event.eventType} · {event.surface ?? "—"}
                    </div>
                    <div className="mt-1 text-sky-900/80">{formatDateTime(event.occurredAt)}</div>
                    {event.citySlug ? (
                      <div className="mt-1 text-sky-900/70">Stadt: {event.citySlug}</div>
                    ) : null}
                    {event.partnerName ? (
                      <div className="mt-1 text-sky-900/70">Partner: {event.partnerName}</div>
                    ) : null}
                    {event.creatorName ? (
                      <div className="mt-1 text-sky-900/70">Creator: {event.creatorName}</div>
                    ) : null}
                    {event.metadata && Object.keys(event.metadata).length > 0 ? (
                      <div className="mt-2 line-clamp-3 text-sky-900/70">
                        {JSON.stringify(event.metadata)}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-xs text-sky-900/70">Noch keine Attribution-Events im Filter.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
