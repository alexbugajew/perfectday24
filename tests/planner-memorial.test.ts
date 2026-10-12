// Tests fuer die Gedenkort-Erkennung (lib/planner/memorial.ts). Alle Namen und
// Titel standen am 12.10.2026 so in locations bzw. planner_events.
//
// Die Negativfaelle sind die eigentliche Absicherung: Ein erster Stand von PR #35
// pruefte den ganzen Suchtext und warf damit den Internationalen
// Weihnachtsmarkt Essen aus allen Markt/Festival-Plaenen, weil seine Summary
// den Volkstrauertag erwaehnt.
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  isSolemnMemorialEvent,
  isSolemnMemorialPlace,
  memorialNameText,
  textHasMemorialMarker,
} from "../lib/planner/memorial";
import { isEligibleMarketFestival } from "../lib/planner/market-festival";

describe("Gedenk-Marker im Titel", () => {
  it("bindet 'gedenk' an den Wortanfang", () => {
    assert.equal(textHasMemorialMarker("Gedenkstunde am Mahnmal"), true);
    assert.equal(textHasMemorialMarker("Gedenke, wo du stehst."), true);
    assert.equal(textHasMemorialMarker("Totengedenken am Volkstrauertag"), true);
    assert.equal(textHasMemorialMarker("KZ-Gedenkstätte Neuengamme"), true);
    // Kabarett-Ankuendigung bzw. Komoedie, keine Gedenkveranstaltung.
    assert.equal(textHasMemorialMarker("Fritz Eckenga – seit Menschengedenken"), false);
    assert.equal(textHasMemorialMarker("Zwischen Sex und Ex – eingedenk der Ex"), false);
    // Literaturmuseum: Bindestrich zaehlt nicht als Wortanfang.
    assert.equal(textHasMemorialMarker("Lesung in der Anna-Seghers-Gedenkstätte"), false);
  });
});

describe("isSolemnMemorialEvent", () => {
  const weihnachtsmarkt = {
    title: "Internationaler Weihnachtsmarkt Essen",
    venue_name: "Kennedyplatz",
    summary: "Täglich geöffnet, am 15. November: Volkstrauertag geschlossen.",
  };

  it("prüft die Benennung, nicht die Summary", () => {
    const name = memorialNameText(weihnachtsmarkt);
    assert.equal(isSolemnMemorialEvent({ name, subtypes: ["market"] }), false);
    assert.equal(
      isEligibleMarketFestival({
        text: `${weihnachtsmarkt.title} ${weihnachtsmarkt.summary}`,
        name,
        subtypes: ["market", "market_event"],
        category: "market",
      }),
      true
    );
  });

  it("erkennt Events an einem Gedenkort über den Veranstaltungsort", () => {
    const name = memorialNameText({
      title: "Sonntagsführung im Flandernbunker",
      venue_name: "Flandernbunker / Mahnmal Kilian",
    });
    assert.equal(isSolemnMemorialEvent({ name }), true);
  });

  it("wertet Friedhof als Venue nicht als Gedenkort", () => {
    // Konzertkirche bzw. Treffpunkt — der Ortsname ist hier Adresse.
    for (const venue of ["Friedhofskirche Elberfeld", "Haltestelle Waldfriedhof Dotzheim"]) {
      const name = memorialNameText({ title: "New York Gospel Stars", venue_name: venue });
      assert.equal(isSolemnMemorialEvent({ name }), false, venue);
    }
  });
});

describe("isSolemnMemorialPlace", () => {
  it("schließt die beiden Auslöser-Orte weiter aus", () => {
    assert.equal(
      isSolemnMemorialPlace({
        name: "Denkmal für die ermordeten Juden Europas",
        subtypes: ["attraction", "historic_site", "landmark", "memorial", "monument"],
      }),
      true
    );
    assert.equal(
      isSolemnMemorialPlace({ name: "Holocaust-Mahnmal", subtypes: ["historic_site"] }),
      true
    );
  });

  it("erkennt Friedhöfe, Ehrenmale und Kriegerdenkmäler am Namen", () => {
    for (const name of [
      "Alter Friedhof Huttrop",
      "Jüdischer Friedhof Altona",
      "Sowjetisches Ehrenmal Tiergarten",
      "Kriegerdenkmal 1914-1918",
      "Denkmal für die im Nationalsozialismus verfolgten Lesben und Schwulen",
      "Gedenkstätte Deutscher Widerstand",
    ]) {
      assert.equal(isSolemnMemorialPlace({ name, subtypes: ["historic_site"] }), true, name);
    }
  });

  it("zählt OSM-'memorial' nicht für sich allein", () => {
    for (const name of [
      "Lilienthal-Denkmal",
      "Freiheits- und Einheitsdenkmal",
      "Bismarck-Denkmal",
      "Mori-Ôgai-Gedenkstätte",
      "Anna-Seghers-Gedenkstätte",
    ]) {
      assert.equal(
        isSolemnMemorialPlace({ name, subtypes: ["landmark", "memorial", "monument"] }),
        false,
        name
      );
    }
  });

  it("ignoriert Friedhof und Ehrenmal als bloße Lageangabe", () => {
    for (const name of [
      "Conviva am Ostfriedhof",
      "Park am Urnenfriedhof Gerichtstraße",
      "Grünanlage am Alten Südfriedhof",
      'Sportplatz "Am Ehrenmal"',
    ]) {
      assert.equal(isSolemnMemorialPlace({ name, subtypes: [] }), false, name);
    }
  });

  it("vergleicht Subtypes exakt", () => {
    assert.equal(isSolemnMemorialPlace({ name: "Parkanlage", subtypes: ["cemetery"] }), true);
    assert.equal(
      isSolemnMemorialPlace({ name: "Parkanlage", subtypes: ["cemetery_garden_cafe"] }),
      false
    );
  });
});
