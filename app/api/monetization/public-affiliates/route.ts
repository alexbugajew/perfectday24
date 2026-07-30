import { NextResponse } from "next/server";
import { resolvePublicAffiliateLinks } from "@/lib/monetization/public-affiliate-server";
import { sanitizeUuidList } from "@/lib/security/db";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

type ResolveAffiliateBody = {
  locationIds?: string[] | null;
  plannerEventIds?: string[] | null;
  routeIds?: string[] | null;
};

/** Obergrenze je ID-Liste — eine Planner-Seite braucht nie mehr. */
const MAX_IDS_PER_FIELD = 50;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "monetization:public-affiliates", RATE_RULES.search);
  if (limited) return limited;

  try {
    const body = (await req.json()) as ResolveAffiliateBody;

    // Nur gültige UUIDs, und höchstens MAX_IDS_PER_FIELD je Feld. Vorher ging
    // die Liste ungeprüft in eine Service-Role-Query — ein Request mit
    // zehntausenden IDs erzeugte entsprechende DB-Last.
    const data = await resolvePublicAffiliateLinks({
      locationIds: sanitizeUuidList(body?.locationIds, MAX_IDS_PER_FIELD),
      plannerEventIds: sanitizeUuidList(body?.plannerEventIds, MAX_IDS_PER_FIELD),
      routeIds: sanitizeUuidList(body?.routeIds, MAX_IDS_PER_FIELD),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Resolve public affiliate links failed:", error);
    return NextResponse.json({ error: "affiliate_resolve_failed" }, { status: 500 });
  }
}
