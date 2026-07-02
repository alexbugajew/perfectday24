import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isOpenAt, parseOpeningHours } from "../lib/planner/opening-hours";

// Helper: baut Date fuer Wochentag + Uhrzeit im lokalen TZ.
// Referenz-Woche: 2026-06-29 = Montag, 2026-06-30 = Dienstag, ... 2026-07-05 = Sonntag.
function dt(dayOffset: number, hh: number, mm = 0): Date {
  // 2026-06-29 = Montag 00:00 local
  const base = new Date(2026, 5, 29, hh, mm, 0);
  const d = new Date(base);
  d.setDate(base.getDate() + dayOffset);
  return d;
}

const MON = 0;
const TUE = 1;
const WED = 2;
const THU = 3;
const FRI = 4;
const SAT = 5;
const SUN = 6;

describe("parseOpeningHours", () => {
  it("returns null for empty/null input", () => {
    assert.equal(parseOpeningHours(null), null);
    assert.equal(parseOpeningHours(""), null);
    assert.equal(parseOpeningHours("   "), null);
  });

  it("parses 24/7", () => {
    const rules = parseOpeningHours("24/7");
    assert.ok(rules);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].spans.length, 1);
    assert.equal(rules[0].spans[0].startMinutes, 0);
    assert.equal(rules[0].spans[0].endMinutes, 24 * 60);
  });

  it("parses simple Mo-Fr range", () => {
    const rules = parseOpeningHours("Mo-Fr 09:00-18:00");
    assert.ok(rules);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].days.size, 5);
  });

  it("parses multi-segment string with semicolon", () => {
    const rules = parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-16:00");
    assert.ok(rules);
    assert.equal(rules.length, 2);
  });

  it("parses multiple time spans separated by comma", () => {
    const rules = parseOpeningHours("Mo-Fr 11:30-14:30,17:30-23:00");
    assert.ok(rules);
    assert.equal(rules[0].spans.length, 2);
  });
});

describe("isOpenAt — Standard-Faelle", () => {
  it("empty/null → offen (safe default)", () => {
    assert.equal(isOpenAt(null, dt(MON, 14)), true);
    assert.equal(isOpenAt("", dt(MON, 14)), true);
  });

  it("24/7 → immer offen", () => {
    assert.equal(isOpenAt("24/7", dt(MON, 0)), true);
    assert.equal(isOpenAt("24/7", dt(SUN, 23, 59)), true);
  });

  it("Mo-Fr 09:00-18:00: Mo 14:00 offen, Mo 08:59 zu, Sa nicht mentioned = zu (OSM implizit closed)", () => {
    const oh = "Mo-Fr 09:00-18:00";
    assert.equal(isOpenAt(oh, dt(MON, 14)), true);
    assert.equal(isOpenAt(oh, dt(MON, 8, 59)), false);
    assert.equal(isOpenAt(oh, dt(FRI, 17, 59)), true);
    assert.equal(isOpenAt(oh, dt(FRI, 18, 0)), false);
    assert.equal(isOpenAt(oh, dt(SAT, 14)), false);
  });

  it("Mo-Fr 09:00-18:00; Sa 10:00-16:00: Sa 09:00 zu, Sa 15:00 offen, Su nicht mentioned = zu", () => {
    const oh = "Mo-Fr 09:00-18:00; Sa 10:00-16:00";
    assert.equal(isOpenAt(oh, dt(SAT, 9, 30)), false);
    assert.equal(isOpenAt(oh, dt(SAT, 15)), true);
    assert.equal(isOpenAt(oh, dt(SUN, 12)), false);
  });
});

describe("isOpenAt — Cross-Midnight (Bars)", () => {
  it("Mo-Su 18:00-02:00: Fr 22:00 offen", () => {
    const oh = "Mo-Su 18:00-02:00";
    assert.equal(isOpenAt(oh, dt(FRI, 22)), true);
  });

  it("Mo-Su 18:00-02:00: Sa 01:00 offen (Vortag-Span reicht rein)", () => {
    const oh = "Mo-Su 18:00-02:00";
    assert.equal(isOpenAt(oh, dt(SAT, 1)), true);
  });

  it("Mo-Su 18:00-02:00: Sa 03:00 zu", () => {
    const oh = "Mo-Su 18:00-02:00";
    assert.equal(isOpenAt(oh, dt(SAT, 3)), false);
  });

  it("Fr-Sa 22:00-04:00: Sa 03:00 offen (Fr-Span reicht rein), Mo 03:00 zu", () => {
    const oh = "Fr-Sa 22:00-04:00";
    assert.equal(isOpenAt(oh, dt(SAT, 3)), true);
    assert.equal(isOpenAt(oh, dt(MON, 3)), false);
  });
});

describe("isOpenAt — Split-Hours (Restaurant Mittag/Abend)", () => {
  it("Mo-Sa 11:30-14:30,17:30-23:00: 15:30 zu, 12:00 offen, 20:00 offen", () => {
    const oh = "Mo-Sa 11:30-14:30,17:30-23:00";
    assert.equal(isOpenAt(oh, dt(TUE, 15, 30)), false);
    assert.equal(isOpenAt(oh, dt(TUE, 12)), true);
    assert.equal(isOpenAt(oh, dt(TUE, 20)), true);
    assert.equal(isOpenAt(oh, dt(TUE, 23, 1)), false);
  });
});

describe("isOpenAt — 24-Uhr-Pizza-Szenario", () => {
  it("Pizzeria Mo-Su 11:00-15:00,17:00-23:00: um 00:00 (24 Uhr) zu", () => {
    const oh = "Mo-Su 11:00-15:00,17:00-23:00";
    // 00:00 = Beginn Folgetag → Vortag-Span endet 23:00 → zu.
    assert.equal(isOpenAt(oh, dt(TUE, 0)), false);
    assert.equal(isOpenAt(oh, dt(TUE, 23, 30)), false);
  });
});

describe("isOpenAt — off/closed", () => {
  it("Mo off; Tu-Su 10:00-18:00: Mo 12:00 zu, Tu 12:00 offen", () => {
    const oh = "Mo off; Tu-Su 10:00-18:00";
    assert.equal(isOpenAt(oh, dt(MON, 12)), false);
    assert.equal(isOpenAt(oh, dt(TUE, 12)), true);
  });
});

describe("isOpenAt — Buffer", () => {
  it("Mit 30 Min Buffer: Ende 18:00, Anfrage 17:45 → zu", () => {
    const oh = "Mo-Fr 09:00-18:00";
    // Ohne Buffer 17:45 offen. Mit 30-Min-Buffer: prueft ob auch 18:15 (17:45+30) noch offen — nein.
    assert.equal(isOpenAt(oh, dt(MON, 17, 45), { bufferMin: 30 }), false);
    assert.equal(isOpenAt(oh, dt(MON, 17, 15), { bufferMin: 30 }), true);
  });
});

describe("isOpenAt — Unparseable Fallback", () => {
  it("Unparseables Format → true (safe default)", () => {
    assert.equal(isOpenAt("dawn to dusk", dt(MON, 12)), true);
    assert.equal(isOpenAt("PH 10:00-14:00", dt(MON, 12)), true);
  });
});
