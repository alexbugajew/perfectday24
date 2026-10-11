import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  cleanPhone,
  isSameWebTarget,
  locationPhoneFromSourceRefs,
  locationWebsiteFromSourceRefs,
  phoneHref,
} from "../lib/planner/location-contact";
import { googleMapsPlaceUrl } from "../lib/planner/maps-link";
import {
  chooseStopPhoto,
  pickAttributedRouteStopPhoto,
  pickMediaAssetPhoto,
  type MediaAssetCandidate,
  type RouteStopPhotoCandidate,
} from "../lib/planner/stop-photo-chain";

describe("locationWebsiteFromSourceRefs / locationPhoneFromSourceRefs", () => {
  const refs = [
    { seed_id: "abc" },
    { address: "Musterweg 1, 04109 Leipzig" },
    { website: "www.lokal.de", phone: "+49 341 123456; +49 341 999999", contact_source: "overpass" },
  ];

  it("findet Website und Telefon im Array neben fremden Einträgen und ergänzt https://", () => {
    assert.equal(locationWebsiteFromSourceRefs(refs), "https://www.lokal.de/");
    assert.equal(locationPhoneFromSourceRefs(refs), "+49 341 123456");
  });

  it("liest auch die Objekt-Form von source_refs", () => {
    assert.equal(locationWebsiteFromSourceRefs({ website: "https://example.org/info" }), "https://example.org/info");
  });

  it("liefert null ohne Eintrag und verwirft nicht-http(s)-Ziele", () => {
    assert.equal(locationWebsiteFromSourceRefs([{ seed_id: "abc" }]), null);
    assert.equal(locationWebsiteFromSourceRefs(null), null);
    assert.equal(locationWebsiteFromSourceRefs({ website: "javascript:alert(1)" }), null);
    assert.equal(locationWebsiteFromSourceRefs({ website: "   " }), null);
    assert.equal(locationPhoneFromSourceRefs({ phone: "   " }), null);
  });
});

describe("cleanPhone / phoneHref", () => {
  it("akzeptiert übliche Schreibweisen", () => {
    assert.equal(cleanPhone("030 1234567"), "030 1234567");
    assert.equal(cleanPhone("+49 (0)30 / 123 45-67"), "+49 (0)30 / 123 45-67");
  });

  it("verwirft Text, zu kurze und zu lange Nummern", () => {
    assert.equal(cleanPhone("siehe Website"), null);
    assert.equal(cleanPhone("12345"), null);
    assert.equal(cleanPhone("1234567890123456"), null);
  });

  it("baut einen tel:-Link ohne Leer- und Sonderzeichen", () => {
    assert.equal(phoneHref("+49 341 123-456"), "tel:+49341123456");
    assert.equal(phoneHref("123"), null);
  });
});

describe("isSameWebTarget", () => {
  it("erkennt dieselbe Seite trotz www, Schema und Schrägstrich", () => {
    assert.equal(isSameWebTarget("https://www.lokal.de/", "lokal.de"), true);
    assert.equal(isSameWebTarget("http://lokal.de/speisekarte/", "https://www.lokal.de/speisekarte"), true);
  });

  it("unterscheidet verschiedene Pfade, Hosts und fehlende Werte", () => {
    assert.equal(isSameWebTarget("https://lokal.de/", "https://lokal.de/reservieren"), false);
    assert.equal(isSameWebTarget("https://opentable.de/r/lokal", "https://lokal.de"), false);
    assert.equal(isSameWebTarget(null, "https://lokal.de"), false);
  });
});

describe("googleMapsPlaceUrl", () => {
  it("nutzt Name + Adresse, wenn eine Adresse bekannt ist", () => {
    const url = new URL(
      googleMapsPlaceUrl({ name: "Café Fein", address: "Musterweg 1, 04109 Leipzig", lat: 51.3, lng: 12.4 }) ?? ""
    );
    assert.equal(url.origin + url.pathname, "https://www.google.com/maps/search/");
    assert.equal(url.searchParams.get("api"), "1");
    assert.equal(url.searchParams.get("query"), "Café Fein, Musterweg 1, 04109 Leipzig");
  });

  it("pinnt ohne Adresse die Koordinate", () => {
    const url = new URL(googleMapsPlaceUrl({ name: "Café Fein", lat: 51.34, lng: 12.37 }) ?? "");
    assert.equal(url.searchParams.get("query"), "51.34,12.37");
  });

  it("liefert ohne Adresse und Koordinaten keinen mehrdeutigen Namens-Link", () => {
    assert.equal(googleMapsPlaceUrl({ name: "Café Fein" }), null);
    assert.equal(googleMapsPlaceUrl({ name: "X", lat: Number.NaN, lng: 12 }), null);
  });
});

function asset(overrides: Partial<MediaAssetCandidate> = {}): MediaAssetCandidate {
  return {
    public_url: "https://cdn.example.com/a.jpg",
    alt_text: null,
    credit_name: "Fotografin",
    rights_status: "confirmed",
    moderation_status: "approved",
    visibility: "public",
    ...overrides,
  };
}

function routeStop(overrides: Partial<RouteStopPhotoCandidate> = {}): RouteStopPhotoCandidate {
  return {
    photo_url: "https://upload.wikimedia.org/x/foto.jpg",
    meta: { image_attribution: { creator: "Jemand", license: "CC BY-SA 4.0" }, image_review_status: "approved" },
    route_creator_type: "editorial",
    route_visibility: "public",
    ...overrides,
  };
}

describe("pickMediaAssetPhoto", () => {
  it("nimmt nur confirmed/licensed, freigegeben und öffentlich", () => {
    assert.equal(pickMediaAssetPhoto([asset({ rights_status: "pending" })]), null);
    assert.equal(pickMediaAssetPhoto([asset({ rights_status: "rejected" })]), null);
    assert.equal(pickMediaAssetPhoto([asset({ moderation_status: "submitted" })]), null);
    assert.equal(pickMediaAssetPhoto([asset({ visibility: "unlisted" })]), null);
    assert.ok(pickMediaAssetPhoto([asset({ rights_status: "licensed" })]));
    assert.ok(pickMediaAssetPhoto([asset({ moderation_status: "featured" })]));
  });

  it("überspringt unbrauchbare Zeilen und nimmt die nächste gültige", () => {
    const picked = pickMediaAssetPhoto([
      asset({ rights_status: "pending", public_url: "https://cdn.example.com/schlecht.jpg" }),
      asset({ public_url: "http://cdn.example.com/unsicher.jpg" }),
      asset({ public_url: "https://cdn.example.com/buch.pdf" }),
      asset({ public_url: "https://cdn.example.com/gut.jpg" }),
    ]);
    assert.equal(picked?.public_url, "https://cdn.example.com/gut.jpg");
  });
});

describe("pickAttributedRouteStopPhoto", () => {
  it("verlangt Bildnachweis sowie öffentliche Redaktions-Routen", () => {
    assert.ok(pickAttributedRouteStopPhoto([routeStop()]));
    assert.equal(pickAttributedRouteStopPhoto([routeStop({ meta: {} })]), null);
    assert.equal(pickAttributedRouteStopPhoto([routeStop({ route_creator_type: "creator" })]), null);
    assert.equal(pickAttributedRouteStopPhoto([routeStop({ route_visibility: "unlisted" })]), null);
  });

  it("verwirft Kontext-Fallbacks, ungeprüfte Bilder und Dokumente", () => {
    const attribution = { image_attribution: { creator: "Jemand" } };
    assert.equal(
      pickAttributedRouteStopPhoto([routeStop({ meta: { ...attribution, image_match_level: "route_context" } })]),
      null
    );
    assert.equal(
      pickAttributedRouteStopPhoto([routeStop({ meta: { ...attribution, image_review_status: "approved_contextual_fallback" } })]),
      null
    );
    assert.equal(pickAttributedRouteStopPhoto([routeStop({ photo_url: "https://upload.wikimedia.org/x/scan.pdf" })]), null);
    assert.equal(pickAttributedRouteStopPhoto([routeStop({ photo_url: "https://upload.wikimedia.org/x/scan.TIF" })]), null);
  });
});

describe("chooseStopPhoto — Reihenfolge der Kette", () => {
  const base = {
    name: "Café Fein",
    sourceRefs: null as unknown,
    mediaAssets: [] as MediaAssetCandidate[],
    routeStops: [] as RouteStopPhotoCandidate[],
    fallback: { category: "cafe", seed: "loc-1", width: 800, height: 450 },
  };

  it("eigener Upload schlägt alles andere", () => {
    const photo = chooseStopPhoto({
      ...base,
      sourceRefs: [{ photo_url: "https://cdn.example.com/eigen.jpg", photo_source: "owner_upload" }],
      mediaAssets: [asset()],
      routeStops: [routeStop()],
    });
    assert.equal(photo.source, "own_upload");
    assert.equal(photo.url, "https://cdn.example.com/eigen.jpg");
  });

  it("danach freigegebene media_assets, dann Bild mit Bildnachweis", () => {
    assert.equal(chooseStopPhoto({ ...base, mediaAssets: [asset()], routeStops: [routeStop()] }).source, "media_asset");
    const attributed = chooseStopPhoto({ ...base, mediaAssets: [asset({ rights_status: "pending" })], routeStops: [routeStop()] });
    assert.equal(attributed.source, "attributed_route_photo");
    assert.ok(attributed.attributionMeta);
  });

  it("ohne verwertbare Quelle bleibt der Kategorie-Fallback", () => {
    const photo = chooseStopPhoto({ ...base, mediaAssets: [asset({ rights_status: "rejected" })] });
    assert.equal(photo.source, "category_fallback");
    assert.match(photo.url, /^https:\/\/images\.unsplash\.com\//);
  });
});
