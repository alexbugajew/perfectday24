import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildAffiliateDeeplink } from "../lib/monetization/affiliate-deeplinks";

// Der Host-Abgleich entscheidet, ob ein Klick mit unserer Awin-Publisher-ID
// rausgeht. Ein zu weiter Match schickt Affiliate-Traffic an Nicht-Partner
// (z.B. die citygames-*.de-Franchise), ein zu enger verschenkt Provision.
// Deshalb hier beide Richtungen festnageln.

function awinmidOf(rawUrl: string): string | null {
  const link = buildAffiliateDeeplink(rawUrl);
  if (!link) return null;
  return new URL(link.url).searchParams.get("awinmid");
}

describe("buildAffiliateDeeplink", () => {
  it("ordnet die freigeschalteten Merchants ihrer awinmid zu", () => {
    assert.equal(awinmidOf("https://www.eventim.de/event/x-123/"), "11388");
    assert.equal(awinmidOf("https://citygame.com/de/berlin"), "122746");
    assert.equal(awinmidOf("https://tiqets.com/de/berlin-c66/"), "8616");
  });

  it("trifft www. und weitere Subdomains sowie Grossschreibung", () => {
    assert.equal(awinmidOf("https://www.citygame.com/de/hamburg"), "122746");
    assert.equal(awinmidOf("https://shop.citygame.com/"), "122746");
    assert.equal(awinmidOf("https://WWW.TIQETS.COM/de/"), "8616");
    assert.equal(awinmidOf("http://www.tiqets.com/en/"), "8616");
  });

  it("trifft keine Fremd-Domains, die nur aehnlich heissen", () => {
    for (const url of [
      "https://evil-citygame.com/",
      "https://citygames-berlin.de/",
      "https://citygame.com.evil.example/",
      "https://mycityhunt.de/",
      "https://nottiqets.com/",
      "https://tiqets.com.evil.example/",
      "https://example.com/?u=https://citygame.com/",
    ]) {
      assert.equal(buildAffiliateDeeplink(url), null, url);
    }
  });

  it("ignoriert Nicht-http(s)-Ziele und kaputte Eingaben", () => {
    assert.equal(buildAffiliateDeeplink(null), null);
    assert.equal(buildAffiliateDeeplink(""), null);
    assert.equal(buildAffiliateDeeplink("citygame.com"), null);
    assert.equal(buildAffiliateDeeplink("javascript://citygame.com/%0aalert(1)"), null);
  });

  it("baut den Deeplink mit Publisher-ID und kodierter Ziel-URL", () => {
    const raw = "https://www.tiqets.com/de/museum?a=1&b=2";
    const link = buildAffiliateDeeplink(raw);
    assert.ok(link);
    assert.equal(link.provider, "Tiqets");
    assert.equal(link.network, "awin");
    const parsed = new URL(link.url);
    assert.equal(parsed.host, "www.awin1.com");
    assert.equal(parsed.searchParams.get("awinaffid"), "3103334");
    assert.equal(parsed.searchParams.get("ued"), raw);
  });
});
