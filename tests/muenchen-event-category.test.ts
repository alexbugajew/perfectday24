// Tests fuer die Kategorie-Erkennung des muenchen.de-Parsers. Anlass: Die
// Auer Dult lief im Oktober 2026 als "other" ein, damit hatte München keinen
// einzigen Markt und der Planner bot im Markt/Festival-Modus ein Museum an.
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeMuenchenDeEvent } from "../lib/events/official/muenchen";
import type { EventSourceConfigRow } from "../lib/events/official/visitberlin";

const CONFIG: EventSourceConfigRow = {
  provider: "muenchen_de",
  city_slug: "muenchen",
  country_code: "DE",
  base_url: "https://www.muenchen.de/veranstaltungen",
  parser_mode: "html",
  label: "muenchen.de",
};

// Aufbau wie das source_payload der echten Zeile vom 17.10.2026, nur Titel und
// Ort variieren. Die Kategorie haengt allein an diesen Texten.
function categoryFor(title: string, venueName: string | null = null) {
  const event = normalizeMuenchenDeEvent(
    {
      sourceUrl: "https://www.muenchen.de/veranstaltungen/test",
      ticketUrl: null,
      title,
      venueName,
      startAt: "2026-10-17T10:00:00+02:00",
      endAt: "2026-10-25T12:00:00Z",
      displayStart: "Sa. 17.10.2026 10:00",
      displayEnd: null,
      rangeStartAt: "2026-10-17T12:00:00Z",
      rangeEndAt: "2026-10-25T12:00:00Z",
      allDay: false,
    },
    CONFIG
  );
  assert.ok(event, title);
  return event;
}

describe("muenchen.de: Dult als Markt", () => {
  it("erkennt die drei Dulten und die Kurzform als Markt", () => {
    const titles = [
      // Exakt der Titel, der am 12.10.2026 neunmal als "other" in der DB stand.
      "Auer Dult - Kirchweihdult",
      "Auer Maidult",
      "Jakobidult",
      "Auer Dult",
    ];
    for (const title of titles) {
      assert.equal(categoryFor(title, "Mariahilfplatz").category, "market", title);
    }
  });

  it("plant die Dult wie andere Maerkte: flexibel, draussen, fuer Tourismus", () => {
    const event = categoryFor("Auer Dult - Kirchweihdult", "Mariahilfplatz");
    assert.equal(event.kind, "flex_event");
    assert.equal(event.indoor_outdoor, "outdoor");
    assert.deepEqual(event.occasions, ["friends", "family", "tourism"]);
  });

  // Die eigentliche Absicherung: "dult" steckt in "adult". Ohne Wortgrenze
  // wuerde aus einem Konzert oder einer Show ein Markt.
  it("macht aus 'adult' keinen Markt", () => {
    assert.equal(categoryFor("Adult Contemporary Konzert", "Olympiahalle").category, "concert");
    assert.equal(categoryFor("Adults only Comedy Show").category, "show");
  });

  it("laesst bestehende Zuordnungen unveraendert", () => {
    assert.equal(categoryFor("Christkindlmarkt am Marienplatz").category, "market");
    assert.equal(categoryFor("Frühlingsfest auf der Theresienwiese").category, "festival");
    assert.equal(categoryFor("Jazzkonzert", "Unterfahrt").category, "concert");
    // "Kirchweih" allein ist kein Markt-Signal, nur die Kirchweihdult.
    assert.equal(categoryFor("Kirchweih-Gottesdienst", "St. Michael").category, "other");
  });
});
