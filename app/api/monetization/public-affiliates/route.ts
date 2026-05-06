import { NextResponse } from "next/server";
import { resolvePublicAffiliateLinks } from "@/lib/monetization/public-affiliate-server";

type ResolveAffiliateBody = {
  locationIds?: string[] | null;
  plannerEventIds?: string[] | null;
  routeIds?: string[] | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResolveAffiliateBody;
    const data = await resolvePublicAffiliateLinks(body ?? {});
    return NextResponse.json(data);
  } catch (error) {
    console.error("Resolve public affiliate links failed:", error);
    return NextResponse.json({ error: "affiliate_resolve_failed" }, { status: 500 });
  }
}
