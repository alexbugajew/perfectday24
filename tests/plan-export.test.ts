import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildPlanIcs, buildPlanPrintHtml, type PlanExportStop } from "../lib/planner/plan-export";
import { locationAddressFromSourceRefs } from "../lib/planner/location-address";

// Minimaler Export-Stop; source_refs steuert den Adress-Fall.
function stop(sourceRefs: unknown, overrides: Partial<PlanExportStop> = {}): PlanExportStop {
  return {
    index: 0,
    label: "Stop 1",
    hint: "",
    item: {
      id: "loc-1",
      name: "Löwenbräukeller",
      type: "restaurant",
      lat: 48.148,
      lng: 11.552,
      reservation_url: null,
      source_refs: sourceRefs,
    },
    durationMin: 90,
    travelMinFromPrev: null,
    scheduledStartAt: "2026-09-12T16:00:00.000Z",
    scheduledEndAt: "2026-09-12T17:30:00.000Z",
    reasons: [],
    ...overrides,
  } as PlanExportStop;
}

const ADDRESS_REFS = [
  { seed_id: "abc", import_batch: "osm_seed_muenchen" },
  { address: "Nymphenburger Straße 2, 80335 München", osm_ref: "way/98064749" },
];

describe("locationAddressFromSourceRefs", () => {
  it("findet die Adresse im Array-Format (osm_seed)", () => {
    assert.equal(
      locationAddressFromSourceRefs(ADDRESS_REFS),
      "Nymphenburger Straße 2, 80335 München"
    );
  });

  it("findet die Adresse im Objekt-Format (planner_event)", () => {
    assert.equal(locationAddressFromSourceRefs({ address: "Musterweg 1, 04109 Leipzig" }), "Musterweg 1, 04109 Leipzig");
  });

  it("liefert null ohne Adresseintrag", () => {
    assert.equal(locationAddressFromSourceRefs([{ seed_id: "abc" }]), null);
    assert.equal(locationAddressFromSourceRefs(null), null);
    assert.equal(locationAddressFromSourceRefs({ address: "   " }), null);
  });
});

describe("buildPlanIcs mit Adresse", () => {
  const input = {
    title: "Abend in München",
    cityLabel: "München",
    planDate: "2026-09-12",
    stops: [stop(ADDRESS_REFS)],
  };

  it("nutzt die Straßenadresse als LOCATION (ICS-escaped)", () => {
    const ics = buildPlanIcs(input);
    assert.ok(
      ics.includes("LOCATION:Löwenbräukeller\\, Nymphenburger Straße 2\\, 80335 München"),
      `LOCATION fehlt/falsch:\n${ics}`
    );
  });

  it("fällt ohne Adresse auf die Stadt zurück", () => {
    const ics = buildPlanIcs({ ...input, stops: [stop(null)] });
    assert.ok(ics.includes("LOCATION:Löwenbräukeller\\, München"), `Fallback fehlt:\n${ics}`);
  });
});

describe("buildPlanPrintHtml mit Adresse", () => {
  it("rendert die Adresszeile unter dem Stop-Namen", () => {
    const html = buildPlanPrintHtml({
      title: "Abend in München",
      cityLabel: "München",
      planDate: "2026-09-12",
      stops: [stop(ADDRESS_REFS)],
    });
    assert.ok(html.includes('<div class="address">Nymphenburger Straße 2, 80335 München</div>'));
  });

  it("lässt die Adresszeile ohne Adresse weg", () => {
    const html = buildPlanPrintHtml({
      title: "Abend in München",
      cityLabel: "München",
      planDate: "2026-09-12",
      stops: [stop(null)],
    });
    assert.ok(!html.includes('class="address"'));
  });
});
