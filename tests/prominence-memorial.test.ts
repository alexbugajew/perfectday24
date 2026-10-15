// Tests für den Gedenkort-Ausschluss und den Namensabgleich des Prominenz-
// Backfills (lib/admin/prominence-memorial.ts, lib/admin/prominence-match.ts).
// Ortsnamen und Subtypes stammen aus public.locations, die Wikidata-Typen per
// wbgetentities (beides Stand 13.10.2026).
//
// Auslöser war der Review zu PR #38: "Sowjetisches Ehrenmal Tiergarten" trug
// keinen der alten Marker, hatte nur den Subtype "landmark" und wäre über den
// Wikipedia-Treffer von 0 geboostet worden.
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isSolemnMemorialName, solemnWikidataType } from "../lib/admin/prominence-memorial";
import { cityTokens, nameMatch } from "../lib/admin/prominence-match";

describe("isSolemnMemorialName", () => {
  it("erkennt die Gedenkorte aus dem Review ohne Beschreibung", () => {
    const cases: Array<[string, string[]]> = [
      ["Sowjetisches Ehrenmal Tiergarten", ["landmark"]],
      ["Sowjetisches Ehrenmal Schönholzer Heide", ["landmark"]],
      ["Denkmal für die ermordeten Juden Europas", ["attraction", "historic_site", "landmark", "memorial", "monument"]],
      ["KZ-Gedenkstätte Neuengamme Ausstellung", ["memorial", "monument", "museum"]],
      ["Mahnmal Todesmarsch KZ Dachau", ["historic_site"]],
      ["KZ-Steinbaracke ehem. KZ-Außenlager Dachau-Allach", ["historic_site"]],
      ["Jüdischer Friedhof Altona", ["historic_site"]],
      ["Alter Südlicher Friedhof", ["historic_site"]],
      ["Italienischer Militärfriedhof", ["historic_site"]],
      ["Gedenkstätte Plötzensee", []],
      ["Gedenkstätte Berlin-Hohenschönhausen", []],
      ["Platz der jüdischen Deportierten", []],
      ["Gefallene der Ukraine", []],
    ];
    for (const [name, subtypes] of cases) assert.equal(isSolemnMemorialName(name, subtypes), true, name);
  });

  it("zählt Wortanfänge auch nach Bindestrich (strenger als der Planner)", () => {
    assert.equal(isSolemnMemorialName("Stasi-Gedenkstätte"), true);
    assert.equal(isSolemnMemorialName("Marine-Ehrenmal"), true);
    assert.equal(isSolemnMemorialName("Opfer-Denkmal"), true);
    assert.equal(isSolemnMemorialName("Kriegergedächtniskapelle"), true);
  });

  it("wertet den Subtype memorial schon allein", () => {
    assert.equal(isSolemnMemorialName("Lilienthal-Denkmal", ["memorial"]), true);
  });

  it("lässt die Ikonen und Namensvettern in Ruhe", () => {
    for (const name of ["Siegessäule", "Elbphilharmonie", "Englischer Garten", "Kaiser-Wilhelm-Gedächtniskirche", "Berliner Fernsehturm", "Brandenburger Tor", "Miniatur Wunderland"]) {
      assert.equal(isSolemnMemorialName(name, ["landmark"]), false, name);
    }
    // "kz" nur am Wortanfang, nicht mitten im Wort.
    assert.equal(isSolemnMemorialName("Glitzkzauber"), false);
  });

  it("prüft nie die Beschreibung — die Funktion bekommt sie gar nicht", () => {
    // Ein Weihnachtsmarkt, dessen Öffnungszeiten den Volkstrauertag erwähnen,
    // bleibt boostbar: Nur Name und Subtypes gehen ein.
    assert.equal(isSolemnMemorialName("Internationaler Weihnachtsmarkt", ["market"]), false);
  });
});

describe("solemnWikidataType", () => {
  it("erkennt die P31-Typen der Gedenkorte im Pool", () => {
    // Sowjetisches Ehrenmal (Tiergarten) Q32660126
    assert.match(solemnWikidataType(["Q39614", "Q2772772", "Q4989906"]) ?? "", /Q39614/);
    // Denkmal für die ermordeten Juden Europas Q160700
    assert.match(solemnWikidataType(["Q20011797"]) ?? "", /Holocaust/);
    // KZ-Gedenkstätte Neuengamme Q1719324 / Dachau Q1532094
    assert.match(solemnWikidataType(["Q5003624", "Q1497649"]) ?? "", /Q5003624/);
    // Jüdischer Friedhof Altona Q1414486
    assert.match(solemnWikidataType(["Q846659"]) ?? "", /Friedhof/);
    // Mahnmal St. Nikolai Q425622
    assert.match(solemnWikidataType(["Q16970", "Q1885014"]) ?? "", /Mahnmal/);
  });

  it("fängt Unterklassen über die Typ-Labels", () => {
    // Waldfriedhof (München) ist "woodland cemetery" Q13424425 — auch ohne Q-ID-Treffer.
    assert.ok(solemnWikidataType(["Q999999999"], ["Waldfriedhof", "woodland cemetery"]));
    assert.ok(solemnWikidataType(["Q999999999"], ["Gefallenendenkmal Deutsch-Französischer Krieg"]));
    assert.ok(solemnWikidataType(["Q999999999"], ["Soviet war memorial"]));
  });

  it("lässt Bauwerke, Parks und Kulturdenkmale durch", () => {
    // Elbphilharmonie Q673223, Englischer Garten (München) Q260223, Fernsehturm Q151356
    assert.equal(solemnWikidataType(["Q1060829", "Q27686", "Q39919471"], ["Konzerthaus", "concert hall", "Hotel", "hotel"]), null);
    assert.equal(solemnWikidataType(["Q22698"], ["Park", "park"]), null);
    assert.equal(solemnWikidataType(["Q11166728", "Q1440300", "Q1081138"], ["Fernsehturm", "television tower"]), null);
    // "denkmal" allein ist bewusst kein Signal.
    assert.equal(solemnWikidataType(["Q999999999"], ["Baudenkmal", "Kulturdenkmal", "monument"]), null);
  });
});

describe("nameMatch", () => {
  const berlin = cityTokens("berlin-berlin");
  const hamburg = cityTokens("hamburg-hamburg");

  it("gibt 'Das Center am Potsdamer Platz' nie den Artikel 'Potsdamer Platz'", () => {
    const match = nameMatch("Das Center am Potsdamer Platz", "Potsdamer Platz", berlin);
    assert.equal(match.kind, "named_after");
    assert.ok(match.conf < 0.5);
    // Der eigene Artikel heißt "Center am Potsdamer Platz" — der passt.
    assert.equal(nameMatch("Das Center am Potsdamer Platz", "Center am Potsdamer Platz", berlin).kind, "exact");
  });

  it("sortiert exakte Treffer vor jeden Teiltreffer", () => {
    const exact = nameMatch("Siegessäule", "Siegessäule (Berlin)", berlin);
    const partial = nameMatch("Siegessäule", "Siegessäule-Panorama Großer Stern", berlin);
    assert.equal(exact.kind, "exact");
    assert.ok(exact.conf > partial.conf, `${exact.conf} > ${partial.conf}`);
    assert.ok(partial.conf <= 0.9);
  });

  it("ignoriert Stadtname und Klammerzusatz", () => {
    assert.equal(nameMatch("Elbphilharmonie Hamburg", "Elbphilharmonie", hamburg).kind, "exact");
    assert.equal(nameMatch("Berliner Fernsehturm", "Berliner Fernsehturm", berlin).conf, 1);
    assert.equal(nameMatch("Fernsehturm", "Berliner Fernsehturm", berlin).kind, "exact");
    assert.equal(nameMatch("Englischer Garten", "Englischer Garten (München)", cityTokens("muenchen")).kind, "exact");
  });

  it("vererbt keine Bekanntheit an Orte, die nur nach etwas benannt sind", () => {
    assert.equal(nameMatch("Deutsches Museum Verkehrszentrum", "Deutsches Museum", cityTokens("muenchen")).kind, "named_after");
    assert.equal(nameMatch("Galerie an der Elbphilharmonie", "Elbphilharmonie", hamburg).kind, "named_after");
    assert.equal(nameMatch("Hamburg Dungeon", "Hamburg", hamburg).kind, "named_after");
  });

  it("wertet den Teil nach der Lage-Präposition als Adresse", () => {
    // Dry-Run 13.10.2026: Der Kunstverein bekam den U-Bahnhof (3 von 4 Wörtern).
    assert.equal(nameMatch("Kunstverein am Rosa-Luxemburg-Platz e.V", "U-Bahnhof Rosa-Luxemburg-Platz", berlin).kind, "named_after");
    assert.equal(nameMatch("Kunstverein am Rosa-Luxemburg-Platz e.V", "Volksbühne am Rosa-Luxemburg-Platz", berlin).kind, "named_after");
    assert.equal(nameMatch("Grünanlage am Alten Südfriedhof", "Alter Südfriedhof (München)", cityTokens("muenchen")).kind, "named_after");
    // Der Ort selbst ist der Teil vor der Präposition.
    assert.equal(nameMatch("Gemäldegalerie am Kulturforum", "Gemäldegalerie (Berlin)", berlin).kind, "exact");
    // Beginnt der Name mit der Präposition, gibt es keine Adresse.
    assert.equal(nameMatch("Am Husarendenkmal", "Husarendenkmal", hamburg).kind, "exact");
  });

  it("behält echte Teiltreffer als Teiltreffer", () => {
    const match = nameMatch("Pergamon", "Pergamonmuseum", berlin);
    assert.equal(match.kind, "partial");
    assert.ok(match.conf >= 0.6 && match.conf <= 0.9);
  });
});
