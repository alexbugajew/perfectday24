import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  findProminenceEntry,
  hasProminenceEntry,
  isBoostableCategory,
  mergeProminenceEntry,
  originalPopularity,
  raisePopularity,
  safetyViolations,
  type ProminenceEntry,
} from "../lib/admin/prominence-refs";

function entry(overrides: Partial<ProminenceEntry> = {}): ProminenceEntry {
  return {
    prominence_source: "wikipedia",
    prominence_score: 16,
    previous_popularity_score: 40,
    wikidata_id: "Q1",
    matched_title: "Heimatmuseum",
    sitelinks: 2,
    pageviews_monthly: 74,
    ...overrides,
  };
}

const SEED_REF = { seed_id: "s1", import_batch: "b1", source_primary: "osm" };

describe("raisePopularity", () => {
  it("senkt den Seed-Standard 40 nie ab (Heimatmuseum-Fall)", () => {
    assert.deepEqual(raisePopularity(40, 16), { previous: 40, next: 40, raised: false });
  });

  it("hebt bekannte Orte über den Sockel", () => {
    assert.deepEqual(raisePopularity(40, 56), { previous: 40, next: 56, raised: true });
  });

  it("behandelt null und 0 gleich, wie der Ranker", () => {
    assert.deepEqual(raisePopularity(null, 16), { previous: 0, next: 16, raised: true });
    assert.deepEqual(raisePopularity(0, 0), { previous: 0, next: 0, raised: false });
  });
});

describe("originalPopularity", () => {
  it("nimmt ohne Prominenz-Eintrag den aktuellen Wert", () => {
    assert.equal(originalPopularity([SEED_REF], 40), 40);
    assert.equal(originalPopularity([SEED_REF], null), null);
  });

  it("reicht den Ursprungswert eines früheren Eintrags weiter (Auto-Match, dann Flaggschiff)", () => {
    const refs = [SEED_REF, entry({ previous_popularity_score: 0, prominence_score: 30 })];
    // Aktuell steht schon 30 in der DB — zurückgerollt werden muss aber auf 0.
    assert.equal(originalPopularity(refs, 30), 0);
  });
});

describe("mergeProminenceEntry", () => {
  it("hängt an ein Array an und lässt fremde Einträge stehen", () => {
    const merged = mergeProminenceEntry([SEED_REF], entry());
    assert.deepEqual(merged, [SEED_REF, entry()]);
  });

  it("ersetzt einen bestehenden Prominenz-Eintrag statt einen zweiten anzuhängen", () => {
    const merged = mergeProminenceEntry([SEED_REF, entry()], entry({ prominence_source: "manual_flagship", prominence_score: 45 }));
    assert.equal(merged.filter((e) => hasProminenceEntry([e])).length, 1);
    assert.equal((findProminenceEntry(merged) as ProminenceEntry).prominence_source, "manual_flagship");
    assert.deepEqual(merged[0], SEED_REF);
  });

  it("mischt nichts in ein Einzelobjekt, sondern macht ein Array daraus", () => {
    const single = { wikidata_id: "Q-fremd", source_primary: "event" };
    const merged = mergeProminenceEntry(single, entry());
    assert.deepEqual(merged, [single, entry()]);
  });

  it("legt bei leerem Feld ein neues Array an", () => {
    assert.deepEqual(mergeProminenceEntry(null, entry()), [entry()]);
  });
});

describe("isBoostableCategory", () => {
  it("boostet nur die erwartete Kategorie", () => {
    assert.equal(isBoostableCategory("culture", ["culture"]), true);
    assert.equal(isBoostableCategory("activity", ["culture"]), false);
    assert.equal(isBoostableCategory(null, ["culture"]), false);
  });

  it("boostet Gastronomie nie, auch wenn sie als erwartet eingetragen ist (Hofbräuhaus)", () => {
    assert.equal(isBoostableCategory("restaurant", ["restaurant", "culture"]), false);
    assert.equal(isBoostableCategory("nightlife", ["nightlife"]), false);
    assert.equal(isBoostableCategory("cafe", ["cafe"]), false);
  });
});

describe("safetyViolations", () => {
  const ok = { name: "Elbphilharmonie", category: "culture", previous: 0, next: 55, solemn: false };

  it("lässt regelkonforme Writes durch", () => {
    assert.deepEqual(safetyViolations([ok, { ...ok, name: "Englischer Garten", category: "activity", previous: 40, next: 48 }]), {
      lowered: [],
      gastronomy: [],
      memorials: [],
    });
  });

  it("meldet Absenkung, Gastronomie und Gedenkort — vor dem Write", () => {
    const result = safetyViolations([
      { ...ok, name: "Heimatmuseum", previous: 40, next: 16 },
      { ...ok, name: "Hofbräuhaus", category: "restaurant" },
      { ...ok, name: "Sowjetisches Ehrenmal Tiergarten", solemn: true },
    ]);
    assert.deepEqual(result, { lowered: ["Heimatmuseum"], gastronomy: ["Hofbräuhaus"], memorials: ["Sowjetisches Ehrenmal Tiergarten"] });
  });

  it("behandelt null als 0, wie raisePopularity", () => {
    assert.deepEqual(safetyViolations([{ ...ok, previous: null, next: 0 }]).lowered, []);
  });
});
