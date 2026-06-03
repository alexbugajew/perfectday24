"use client";

/**
 * useMonetizationTracking
 *
 * Facade hook over trackMonetizationEvent that:
 * - Provides typed convenience methods for common tracking patterns
 * - Eliminates repetitive `userId` / `surface` prop drilling in components
 * - Silently no-ops when consent is not given (handled by trackMonetizationEvent)
 *
 * Usage:
 *   const track = useMonetizationTracking({ userId, citySlug });
 *   track.planIntent({ planId, occasion, stopsCount });
 *   track.routeView({ routeId });
 *   track.routeCopy({ surface: "planner" });
 */

import { useCallback } from "react";
import { trackMonetizationEvent } from "./client";
import type { ClientMonetizationTrackInput } from "./client";

type BaseContext = {
  userId?: string | null;
  citySlug?: string | null;
};

type PlanIntentParams = {
  planId?: string | null;
  occasion?: string | null;
  experienceMode?: string | null;
  planMode?: string | null;
  stopsCount?: number | null;
  variantCount?: number | null;
  surface?: string;
};

type RouteViewParams = {
  routeId?: string | null;
  creatorProfileId?: string | null;
  surface?: string;
};

type RouteCopyParams = {
  routeId?: string | null;
  surface?: string;
  metadata?: Record<string, unknown>;
};

type RouteBookmarkParams = {
  routeId?: string | null;
  surface?: string;
};

type AffiliateLinkParams = {
  affiliateLinkId: string;
  targetUrl?: string | null;
  surface?: string;
  locationId?: string | null;
  partnerProfileId?: string | null;
  onceKey?: string | null;
};

type EventViewParams = {
  planId?: string | null;
  surface?: string;
  metadata?: Record<string, unknown>;
};

function fire(input: ClientMonetizationTrackInput) {
  void trackMonetizationEvent(input);
}

export function useMonetizationTracking(ctx: BaseContext = {}) {
  const { userId = null, citySlug = null } = ctx;

  const planIntent = useCallback((params: PlanIntentParams = {}) => {
    fire({
      eventType: "plan_intent",
      userId,
      planId: params.planId ?? null,
      citySlug,
      surface: params.surface ?? "planner",
      metadata: {
        occasion: params.occasion,
        experienceMode: params.experienceMode,
        planMode: params.planMode,
        stopsCount: params.stopsCount,
        variantCount: params.variantCount,
      },
    });
  }, [userId, citySlug]);

  const routeView = useCallback((params: RouteViewParams = {}) => {
    fire({
      eventType: "route_view",
      userId,
      routeId: params.routeId ?? null,
      creatorProfileId: params.creatorProfileId ?? null,
      citySlug,
      surface: params.surface ?? "routes",
    });
  }, [userId, citySlug]);

  const routeCopy = useCallback((params: RouteCopyParams = {}) => {
    fire({
      eventType: "route_copy",
      userId,
      routeId: params.routeId ?? null,
      citySlug,
      surface: params.surface ?? "planner",
      metadata: params.metadata,
    });
  }, [userId, citySlug]);

  const routeBookmark = useCallback((params: RouteBookmarkParams = {}) => {
    // "route_copy" is the closest available type for bookmark/save actions
    fire({
      eventType: "route_copy",
      userId,
      routeId: params.routeId ?? null,
      citySlug,
      surface: params.surface ?? "explore",
      metadata: { action: "bookmark" },
    });
  }, [userId, citySlug]);

  const affiliateClick = useCallback((params: AffiliateLinkParams) => {
    fire({
      eventType: "click",
      userId,
      affiliateLinkId: params.affiliateLinkId,
      citySlug,
      locationId: params.locationId ?? null,
      partnerProfileId: params.partnerProfileId ?? null,
      surface: params.surface ?? "routes",
      onceKey: params.onceKey ?? params.affiliateLinkId,
    });
  }, [userId, citySlug]);

  const eventView = useCallback((params: EventViewParams = {}) => {
    fire({
      eventType: "plan_intent",
      userId,
      planId: params.planId ?? null,
      citySlug,
      surface: params.surface ?? "events",
      metadata: params.metadata,
    });
  }, [userId, citySlug]);

  return {
    planIntent,
    routeView,
    routeCopy,
    routeBookmark,
    affiliateClick,
    eventView,
    /** Raw escape hatch for one-off events */
    track: (input: ClientMonetizationTrackInput) => fire({ userId, citySlug, ...input }),
  };
}
