// Awin-Deeplinks fuer freigeschaltete Merchants.
//
// Statt pro Event/Location eine Zeile in affiliate_links zu pflegen, wird der
// Deeplink dynamisch aus dem Ziel-Host gebaut: zeigt eine ticket_url auf einen
// bekannten Awin-Merchant, wird sie ueber awin1.com/cread.php mit unserer
// Publisher-ID geleitet. So monetarisiert jeder kuenftige Merchant durch einen
// Katalog-Eintrag hier, nicht durch Datenpflege ueber tausende Events.
//
// Der erzeugte Deeplink wird als `target` an /api/monetization/redirect gegeben:
// der Redirect erkennt "awin" am Host und haengt die awc-Klick-ID fuer die
// Postback-Reconciliation an (siehe app/api/monetization/redirect/route.ts).

// Unsere Awin-Publisher-ID (perfectday24 UG). Fest ueber alle Merchants.
const AWIN_AFFID = "3103334";

type AwinMerchant = {
  provider: string;
  awinmid: string;
  // Trifft den Ziel-Host inkl. Subdomains (z.B. www./shop.).
  matches: (host: string) => boolean;
};

// NUR Merchants, deren Awin-Programm bestaetigt freigeschaltet ist. Ein neuer
// Merchant kommt erst hier rein, wenn die Freigabe steht — sonst laufen Klicks
// ins Leere (kein gueltiger awinmid) statt auf den rohen Ticket-Link.
const AWIN_MERCHANTS: AwinMerchant[] = [
  {
    provider: "Eventim",
    awinmid: "11388",
    matches: (host) => host === "eventim.de" || host.endsWith(".eventim.de"),
  },
  // Kuenftig nach Awin-Freigabe, je eine Zeile:
  //   Tiqets   tiqets.com    → awinmid 8616
  //   ATG      … → 111888,  Turbopass → 11624,  Viator → 10397,  …
];

export type AffiliateDeeplink = {
  url: string; // awin1.com/cread.php-Deeplink
  provider: string; // z.B. "Eventim" — fuer Button-Text/Disclosure
  network: "awin";
};

/**
 * Baut aus einer rohen Ziel-URL einen Awin-Deeplink, wenn deren Host zu einem
 * freigeschalteten Merchant gehoert. Sonst null (dann bleibt der rohe Link).
 */
export function buildAffiliateDeeplink(
  rawUrl: string | null | undefined
): AffiliateDeeplink | null {
  if (!rawUrl) return null;

  let host: string;
  try {
    const parsed = new URL(rawUrl);
    // Nur echte http(s)-Ziele; kein mailto:, javascript: etc.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  const merchant = AWIN_MERCHANTS.find((entry) => entry.matches(host));
  if (!merchant) return null;

  const deeplink =
    `https://www.awin1.com/cread.php?awinmid=${merchant.awinmid}` +
    `&awinaffid=${AWIN_AFFID}` +
    `&ued=${encodeURIComponent(rawUrl)}`;

  return { url: deeplink, provider: merchant.provider, network: "awin" };
}
