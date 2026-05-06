export type PublicAffiliateMatch = {
  id: string;
  partnerProfileId: string | null;
  partnerName: string | null;
  partnerSlug: string | null;
  providerName: string;
  destinationUrl: string;
  deepLinkUrl: string | null;
  targetUrl: string;
  commissionModel: string;
  priority: number;
};

export type PublicAffiliateResolution = {
  byLocationId: Record<string, PublicAffiliateMatch>;
  byPlannerEventId: Record<string, PublicAffiliateMatch>;
  byRouteId: Record<string, PublicAffiliateMatch>;
};

export const EMPTY_PUBLIC_AFFILIATE_RESOLUTION: PublicAffiliateResolution = {
  byLocationId: {},
  byPlannerEventId: {},
  byRouteId: {},
};

export function emptyPublicAffiliateResolution(): PublicAffiliateResolution {
  return EMPTY_PUBLIC_AFFILIATE_RESOLUTION;
}
