// Tests fuer die Aufbereitung der Event-Rohdaten: Titel, Kategorie und
// Einlasszeit. Alle drei korrigieren Werte, die die Quellen unbrauchbar
// liefern, bevor sie in Plaene oder Navigation geraten.
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  normalizePlannerEventTitle,
  plannerEventCategoriesForExperienceMode,
  refinePlannerEventCategory,
} from "../lib/planner/events";
import { plausibleDoorsAt } from "../lib/planner/route/timing";

/**
 * Die Positivfälle sind die neun Titel, die am 20.08.2026 tatsächlich in
 * planner_events standen (127 Zeilen, alle aus der Quelle hamburg_de).
 *
 * Die Negativfälle sind die eigentliche Absicherung: Ordnungszahlen im Namen
 * sehen einer Datumsangabe zum Verwechseln ähnlich, und ein zu gieriges Muster
 * würde aus "4. Schlosskonzert" ein "Schlosskonzert" machen. Genau daran ist
 * ein erster Entwurf gescheitert.
 */
describe("normalizePlannerEventTitle", () => {
  it("entfernt vorangestellte Datumsspannen", () => {
    const cases: Array<[string, string]> = [
      ["25. Juli bis 2. August 2026 Hamburg Pride Week", "Hamburg Pride Week"],
      ["6. November bis 6. Dezember 2026 Auf zum Winterdom!", "Auf zum Winterdom!"],
      ["24. September bis 3. Oktober 2026 FilmFest Hamburg", "FilmFest Hamburg"],
      ["14. und 15. August 2026 MS Dockville", "MS Dockville"],
      ["8. November 2026 Verkaufsoffener Sonntag", "Verkaufsoffener Sonntag"],
      [
        "13. bis 18. Oktober 2026 Hamburg International Queer Film Festival",
        "Hamburg International Queer Film Festival",
      ],
      ["20. bis 29. August 2026 Hamburger Kultursommer", "Hamburger Kultursommer"],
      ["11. bis 13. September 2026 Tag des offenen Denkmals", "Tag des offenen Denkmals"],
      ["16. bis 19. September 2026 Reeperbahn Festival", "Reeperbahn Festival"],
    ];

    for (const [input, expected] of cases) {
      assert.equal(normalizePlannerEventTitle(input), expected, input);
    }
  });

  it("lässt Ordnungszahlen im Namen unangetastet", () => {
    const untouched = [
      "4. Schlosskonzert | Duo Fortezza",
      "2. Kinderkonzert – Karneval der Tiere",
      "60. Kunstausstellung im Sozialgericht",
      "14. Rudelsingen",
      "40. Küllenhahner Hoffest",
      "3. Bergischer Gladbacher Orgelsommer",
      "57. Bundeswettbewerb für Jungen und Mädchen Im Rudern",
      "1. NachtKlänge – Portrait Caio de Azevedo",
    ];

    for (const title of untouched) {
      assert.equal(normalizePlannerEventTitle(title), title, title);
    }
  });

  it("lässt Titel ohne Datumspräfix unverändert", () => {
    const untouched = [
      "Pentatonix - European Tour 2026",
      "„6. August 1870“",
      "Cirque du Soleil ALIZÉ",
      "Sommerfestival im Olympiapark",
      "",
    ];

    for (const title of untouched) {
      assert.equal(normalizePlannerEventTitle(title), title, title);
    }
  });

  it("behält den Originaltitel, wenn nach dem Abschneiden nichts Sinnvolles bleibt", () => {
    assert.equal(normalizePlannerEventTitle("14. und 15. August 2026"), "14. und 15. August 2026");
    assert.equal(normalizePlannerEventTitle("3. Mai 2026 –"), "3. Mai 2026 –");
  });
});

/**
 * Die Nachklassifizierung greift nur aus den Sammel-Eimern heraus und nur auf
 * den Titel. Ein erster Entwurf las auch die Beschreibung — und machte aus der
 * Bootsmesse "boat 2027" eine Comedy, weil im Rahmenprogramm eine erwaehnt war.
 */
describe("refinePlannerEventCategory", () => {
  it("erkennt Ausstellungen in den Sammel-Kategorien", () => {
    const cases: Array<[string, string]> = [
      ["fair", "Sonderausstellung zum 150. Geburtstag des Telefons"],
      ["fair", "Angewandte Kunst und Skulpturen - Dauerausstellung"],
      ["show", "Gelebte Reformation. Die Barmer Theologische Ausstellung"],
      ["community", "Sonntagsführung durch die Dauerausstellung"],
      ["other", "Galerie Anja Es: KUNST!"],
    ];
    for (const [category, title] of cases) {
      assert.equal(refinePlannerEventCategory({ category, title }), "exhibition", title);
    }
  });

  it("erkennt Comedy in den Sammel-Kategorien", () => {
    const cases: Array<[string, string]> = [
      ["show", "Saying the Wrong Thing — English Stand-up Comedy in Berlin"],
      ["show", "Comedy Club: die Stand-up-Show"],
      ["community", "Comedy | Martin Schopps \"Elternabend\""],
      ["other", "Kabarett am Abend"],
    ];
    for (const [category, title] of cases) {
      assert.equal(refinePlannerEventCategory({ category, title }), "comedy", title);
    }
  });

  /**
   * Alle elf Titel standen am 31.08.2026 so in planner_events. Aufgefallen ist
   * das, weil der Kernflow Hamburg/tourism/market_festival rot wurde: Das
   * einzige Markt/Festival-Event des Tages war die Minsk-Gedenkveranstaltung.
   *
   * Die Regel greift bewusst aus JEDER Kategorie heraus, nicht nur aus den
   * Sammel-Eimern — der Freiburger Fall lag als `festival` vor.
   */
  it("nimmt Gedenkveranstaltungen aus der Freizeitplanung", () => {
    const cases: Array<[string, string]> = [
      ["festival", "Gedenkveranstaltung zum Jahrestag der Deportation der Freiburger Jüdinnen und Juden"],
      ["seasonal", "„Wie lange werden wir hier sein?“ – Deportationen nach Minsk 1941"],
      ["fair", "Unter Tage. Unter Zwang. NS-Zwangsarbeit im Ruhrbergbau"],
      ["community", "Gedenkfeier zum Jahrestag der Pogromnacht"],
      ["community", "Führung: Auftakt des Terrors. Frühe Konzentrationslager"],
      ["theater", "Vortrag: Zeitzeugin und Holocaust-Überlebende Eva Weyl berichtet"],
      ["theater", "Lebendige Stolpersteine"],
      ["show", "Vortrag: Sterilisation und Euthanasie psychisch kranker Bürger"],
      ["show", "Gedenke, wo du stehst."],
      ["market", "Gedenkstunde am Mahnmal"],
    ];
    for (const [category, title] of cases) {
      assert.equal(refinePlannerEventCategory({ category, title }), "other", title);
    }
  });

  /**
   * `other` steht in keiner Liste von plannerEventCategoriesForExperienceMode.
   * Genau daran haengt die Wirkung der Regel — faellt diese Zusicherung, landen
   * Gedenkveranstaltungen wieder in Tagesplaenen, ohne dass ein Test anschlaegt.
   */
  it("haelt `other` aus allen Erlebnismodi heraus", () => {
    for (const mode of ["show", "event_visit", "market_festival"]) {
      assert.equal(
        plannerEventCategoriesForExperienceMode(mode).includes("other" as never),
        false,
        mode
      );
    }
  });

  it("lässt belastbare Kategorien unangetastet", () => {
    // Ein Konzert bleibt ein Konzert, auch wenn der Titel "Comedy" enthält.
    assert.equal(
      refinePlannerEventCategory({ category: "concert", title: "Comedy-Rock Live" }),
      "concert"
    );
    assert.equal(
      refinePlannerEventCategory({ category: "theater", title: "Ausstellungsstück" }),
      "theater"
    );
    assert.equal(
      refinePlannerEventCategory({ category: "market", title: "Kunstmarkt im Museum" }),
      "market"
    );
  });

  it("lässt Sammel-Kategorien ohne Signal, wie sie sind", () => {
    assert.equal(refinePlannerEventCategory({ category: "fair", title: "boat 2027" }), "fair");
    assert.equal(refinePlannerEventCategory({ category: "fair", title: "Herbstkirmes" }), "fair");
    assert.equal(refinePlannerEventCategory({ category: "show", title: "" }), "show");
    assert.equal(refinePlannerEventCategory({ category: "community", title: null }), "community");
  });
});

/**
 * Der Einlass aus der Quelle darf die Zeitschiene nicht sprengen: Ticketmaster
 * liefert in doors_at ueberwiegend den Import-Zeitstempel statt eines Einlasses
 * (643 von 653 Werten unplausibel). Ungeprueft uebernommen zog er den
 * Event-Stop stundenlang nach vorn.
 */
describe("plausibleDoorsAt", () => {
  const start = new Date("2026-08-20T17:00:00Z"); // 19:00 Ortszeit

  it("akzeptiert einen Einlass kurz vor Beginn", () => {
    const doors = new Date("2026-08-20T16:30:00Z");
    assert.equal(plausibleDoorsAt(doors, start)?.toISOString(), doors.toISOString());
  });

  it("akzeptiert Einlass gleichzeitig mit Beginn", () => {
    assert.equal(plausibleDoorsAt(start, start)?.toISOString(), start.toISOString());
  });

  it("verwirft einen Einlass Monate vor dem Termin", () => {
    // Der reale Fall: Import-Zeitstempel vom 24. April fuer ein Event im August.
    assert.equal(plausibleDoorsAt(new Date("2026-04-24T13:28:08Z"), start), null);
  });

  it("verwirft einen Einlass nach Beginn", () => {
    assert.equal(plausibleDoorsAt(new Date("2026-08-20T18:00:00Z"), start), null);
  });

  it("verwirft einen Einlass mehr als vier Stunden vor Beginn", () => {
    assert.equal(plausibleDoorsAt(new Date("2026-08-20T12:00:00Z"), start), null);
  });

  it("kommt mit fehlenden Werten zurecht", () => {
    assert.equal(plausibleDoorsAt(null, start), null);
    assert.equal(plausibleDoorsAt(start, null), null);
  });
});
