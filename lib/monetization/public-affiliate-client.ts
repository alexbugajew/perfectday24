import {
  emptyPublicAffiliateResolution,
  type PublicAffiliateResolution,
} from "./affiliate-shared";

type ResolveAffiliateRequest = {
  locationIds?: string[] | null;
  plannerEventIds?: string[] | null;
  routeIds?: string[] | null;
};

export async function resolvePublicAffiliateLinksClient(
  input: ResolveAffiliateRequest
): Promise<PublicAffiliateResolution> {
  const resp = await fetch("/api/monetization/public-affiliates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "affiliate_resolve_failed");
  }

  const payload = (await resp.json()) as PublicAffiliateResolution | null;
  return payload ?? emptyPublicAffiliateResolution();
}
