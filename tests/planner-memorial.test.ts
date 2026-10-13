// Tests für die Gedenkort-Erkennung (lib/planner/memorial.ts). Orts- und
// Eventnamen stammen aus locations bzw. planner_events (Stand 12./13.10.2026).
// Ausnahme sind die beiden Bühnen-Titel im ersten Block: Live stand
// "Menschengedenken" bzw. "eingedenk" nur in der Beschreibung, die seit diesem
// PR gar nicht mehr geprüft wird. Die Titel dort sind konstruiert, damit die
// Wortanfang-Regel trotzdem abgesichert ist.
//
// Die Negativfälle sind die eigentliche Absicherung: Ein erster Stand von PR #35
// prüfte den ganzen Suchtext und warf damit den Internationalen
// Weihnachtsmarkt Essen aus allen Markt/Festival-Plänen, weil seine Summary
// den Volkstrauertag erwähnt.
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
    // Kabarett bzw. Komödie, keine Gedenkveranstaltung (Titel konstruiert, s.o.).
    assert.equal(textHasMemorialMarker("Fritz Eckenga – seit Menschengedenken"), false);
    assert.equal(textHasMemorialMarker("Zwischen Sex und Ex – eingedenk der Ex"), false);
    // Literaturmuseum: Bindestrich zählt nicht als Wortanfang.
    assert.equal(textHasMemorialMarker("Lesung in der Anna-Seghers-Gedenkstätte"), false);
  });

  it("erkennt 'KZ' nur als eigenes Wort", () => {
    assert.equal(textHasMemorialMarker("Todesmarsch KZ Dachau"), true);
    assert.equal(textHasMemorialMarker("KZ-Steinbaracke ehem. KZ-Außenlager Dachau-Allach"), true);
    assert.equal(textHasMemorialMarker("Kantine KZV"), false);
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

  it("erkennt KZ-, Deportations- und Kriegsopfer-Orte ohne 'Gedenk' im Namen", () => {
    for (const [name, subtypes] of [
      ["Todesmarsch KZ Dachau", ["historic_site"]],
      ["KZ-Steinbaracke ehem. KZ-Außenlager Dachau-Allach", ["historic_site"]],
      ["Platz der jüdischen Deportierten", ["park"]],
      ["Gefallene der Ukraine", ["historic_site"]],
      ["Kriegergedächtniskapelle", ["historic_site"]],
      ["Opfer Zweiter Weltkrieg", ["historic_site"]],
      ["Den Opfern der Nationalsozialistischen Gewaltherrschaft", ["historic_site"]],
    ] as const) {
      assert.equal(isSolemnMemorialPlace({ name, subtypes }), true, name);
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

  it("bindet 'Opfer' an den Wortanfang", () => {
    // Baudenkmal in Dormagen-Zons (OSM historic=yes), dreifach importiert
    // (Langenfeld, Monheim, Dormagen). "opfer" steckt nur in "Klopfer".
    assert.equal(
      isSolemnMemorialPlace({
        name: "Der Steinklopfer",
        subtypes: ["attraction", "historic_site", "landmark"],
      }),
      false
    );
    // Opfer-Gedenkorte, bei denen "Opfer" das einzige Signal ist, bleiben
    // solemn — auch hinter einem Bindestrich. Dazu die beiden Komposita, die
    // als eigene Kontextwörter nachgezogen sind, und ein Stolperstein.
    for (const name of [
      "Opfer des Faschismus",
      "Den Opfern des Rassenwahns",
      "NS-Opfer",
      "Denkmal für Soldaten und zivile Bombenopfer",
      "Wegekreuz Fliegerbombenopfer",
      "Grenzopfer",
      "Stolperstein für Albert Hirsch",
    ]) {
      assert.equal(isSolemnMemorialPlace({ name, subtypes: ["historic_site"] }), true, name);
    }
    // Nicht abgesichert: Stolpersteine, die nur den Namen der Person tragen
    // ("Maria Klopfer", München). Sie trafen bisher allein zufällig über
    // "Klopfer"; der Name trägt kein Signal, und memorial=stolperstein aus OSM
    // steht nicht in den Daten.
  });

  it("braucht für Kontextwörter ein Denkmal-Signal", () => {
    assert.equal(isSolemnMemorialPlace({ name: "Sportplatz Opferberg", subtypes: [] }), false);
    assert.equal(isSolemnMemorialPlace({ name: "Antikriegscafé COOP", subtypes: ["cocktail_bar"] }), false);
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
