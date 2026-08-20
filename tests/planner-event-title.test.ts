import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { normalizePlannerEventTitle } from "../lib/planner/events";

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
