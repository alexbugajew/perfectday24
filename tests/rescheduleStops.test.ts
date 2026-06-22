import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { PlannedStop } from "../lib/planner";
import { rescheduleStops, sortStopsChronologically } from "../app/planner/rescheduleStops";

function makeStop(overrides: Partial<PlannedStop>): PlannedStop {
  return {
    index: 1,
    label: "Stop",
    hint: "",
    item: null,
    durationMin: 60,
    travelMinFromPrev: 0,
    scheduledStartAt: null,
    scheduledEndAt: null,
    timingLock: "none",
    timingWarnings: [],
    reasons: [],
    groupDecision: null,
    debug: null,
    ...overrides,
  };
}

function minutesBetween(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) throw new Error("scheduled time missing");
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

describe("rescheduleStops", () => {
  it("returns empty array unchanged", () => {
    assert.deepEqual(rescheduleStops([]), []);
  });

  it("returns original stops if no scheduledStartAt anchor exists", () => {
    const stops = [makeStop({ index: 1 }), makeStop({ index: 2 })];
    const result = rescheduleStops(stops);
    assert.equal(result, stops);
  });

  it("walks stops forward from earliest anchor and applies duration + travel", () => {
    const stops = [
      makeStop({
        index: 1,
        durationMin: 60,
        scheduledStartAt: "2026-06-22T17:00:00.000Z",
        scheduledEndAt: "2026-06-22T18:00:00.000Z",
      }),
      makeStop({
        index: 2,
        durationMin: 90,
        travelMinFromPrev: 15,
        scheduledStartAt: "2026-06-22T18:15:00.000Z",
        scheduledEndAt: "2026-06-22T19:45:00.000Z",
      }),
      makeStop({
        index: 3,
        durationMin: 45,
        travelMinFromPrev: 10,
        scheduledStartAt: "2026-06-22T19:55:00.000Z",
        scheduledEndAt: "2026-06-22T20:40:00.000Z",
      }),
    ];

    const result = rescheduleStops(stops);

    assert.equal(result[0].scheduledStartAt, "2026-06-22T17:00:00.000Z");
    assert.equal(result[0].scheduledEndAt, "2026-06-22T18:00:00.000Z");
    // Stop 2 startet bei previousEnd + 15min travel = 18:15
    assert.equal(result[1].scheduledStartAt, "2026-06-22T18:15:00.000Z");
    assert.equal(result[1].scheduledEndAt, "2026-06-22T19:45:00.000Z");
    // Stop 3 startet bei 19:55, endet 20:40
    assert.equal(result[2].scheduledStartAt, "2026-06-22T19:55:00.000Z");
    assert.equal(result[2].scheduledEndAt, "2026-06-22T20:40:00.000Z");
  });

  it("recomputes times after manual reorder so each stop has fresh schedule", () => {
    // Original order: Stop A (60min) @ 17:00, Stop B (90min) @ 18:15 with travel 15
    // User reorders to [B, A] — we expect B at anchor (17:00) and A at B's end
    const stopA = makeStop({
      index: 1,
      durationMin: 60,
      travelMinFromPrev: 0,
      scheduledStartAt: "2026-06-22T17:00:00.000Z",
      scheduledEndAt: "2026-06-22T18:00:00.000Z",
    });
    const stopB = makeStop({
      index: 2,
      durationMin: 90,
      travelMinFromPrev: 15,
      scheduledStartAt: "2026-06-22T18:15:00.000Z",
      scheduledEndAt: "2026-06-22T19:45:00.000Z",
    });

    const result = rescheduleStops([stopB, stopA]);

    // Anchor = earliest = 17:00. First stop in new order = B → starts at 17:00.
    assert.equal(result[0].index, 2);
    assert.equal(result[0].scheduledStartAt, "2026-06-22T17:00:00.000Z");
    assert.equal(minutesBetween(result[0].scheduledStartAt, result[0].scheduledEndAt), 90);

    // A folgt B mit travel=0 (Stop A had travelMinFromPrev=0)
    assert.equal(result[1].index, 1);
    assert.equal(result[1].scheduledStartAt, result[0].scheduledEndAt);
    assert.equal(minutesBetween(result[1].scheduledStartAt, result[1].scheduledEndAt), 60);
  });

  it("preserves event-locked stop's absolute time and walks others around it", () => {
    const stops = [
      makeStop({
        index: 1,
        durationMin: 60,
        scheduledStartAt: "2026-06-22T17:00:00.000Z",
        scheduledEndAt: "2026-06-22T18:00:00.000Z",
      }),
      makeStop({
        index: 2,
        durationMin: 120,
        travelMinFromPrev: 15,
        timingLock: "event",
        scheduledStartAt: "2026-06-22T19:30:00.000Z",
        scheduledEndAt: "2026-06-22T21:30:00.000Z",
      }),
      makeStop({
        index: 3,
        durationMin: 45,
        travelMinFromPrev: 10,
      }),
    ];

    const result = rescheduleStops(stops);

    // Event-Stop bleibt absolut bei 19:30 fix, auch wenn der pre-stop nicht aufgegangen ist
    assert.equal(result[1].scheduledStartAt, "2026-06-22T19:30:00.000Z");
    assert.equal(result[1].scheduledEndAt, "2026-06-22T21:30:00.000Z");
    assert.equal(result[1].timingLock, "event");

    // Stop 3 folgt nach Event-Ende + travel
    assert.equal(result[2].scheduledStartAt, "2026-06-22T21:40:00.000Z");
    assert.equal(result[2].scheduledEndAt, "2026-06-22T22:25:00.000Z");
  });

  it("pushes a timing warning if previous stop overshoots event start", () => {
    const stops = [
      makeStop({
        index: 1,
        durationMin: 180, // sehr lang
        scheduledStartAt: "2026-06-22T17:00:00.000Z",
        scheduledEndAt: "2026-06-22T20:00:00.000Z",
      }),
      makeStop({
        index: 2,
        durationMin: 90,
        travelMinFromPrev: 15,
        timingLock: "event",
        scheduledStartAt: "2026-06-22T19:30:00.000Z",
        scheduledEndAt: "2026-06-22T21:00:00.000Z",
      }),
    ];

    const result = rescheduleStops(stops);

    // Stop 1 endet 20:00, travel 15min, arrival 20:15. Event-Start 19:30 → overshoot 45min
    assert.equal(result[1].scheduledStartAt, "2026-06-22T19:30:00.000Z"); // bleibt fix
    assert.ok(result[1].timingWarnings && result[1].timingWarnings.length > 0);
    const warning = result[1].timingWarnings![result[1].timingWarnings!.length - 1];
    assert.match(warning, /überzieht den Event-Start um ca\. 45 Min/);
  });

  it("uses stop.item.duration_min when stop.durationMin is null", () => {
    const stops = [
      makeStop({
        index: 1,
        durationMin: null,
        item: { duration_min: 75 } as unknown as PlannedStop["item"],
        scheduledStartAt: "2026-06-22T18:00:00.000Z",
        scheduledEndAt: "2026-06-22T19:15:00.000Z",
      }),
    ];

    const result = rescheduleStops(stops);
    // Anchor 18:00, duration 75min aus item → 19:15
    assert.equal(result[0].scheduledStartAt, "2026-06-22T18:00:00.000Z");
    assert.equal(result[0].scheduledEndAt, "2026-06-22T19:15:00.000Z");
  });

  it("falls back to 60 min when no duration is set anywhere", () => {
    const stops = [
      makeStop({
        index: 1,
        durationMin: null,
        item: null,
        scheduledStartAt: "2026-06-22T18:00:00.000Z",
      }),
    ];

    const result = rescheduleStops(stops);
    assert.equal(minutesBetween(result[0].scheduledStartAt, result[0].scheduledEndAt), 60);
  });
});

describe("sortStopsChronologically", () => {
  it("sorts stops by scheduledStartAt ascending", () => {
    const stops = [
      makeStop({ index: 3, scheduledStartAt: "2026-06-22T20:00:00.000Z" }),
      makeStop({ index: 1, scheduledStartAt: "2026-06-22T17:00:00.000Z" }),
      makeStop({ index: 2, scheduledStartAt: "2026-06-22T18:30:00.000Z" }),
    ];

    const result = sortStopsChronologically(stops);

    assert.deepEqual(result.map((s) => s.index), [1, 2, 3]);
  });

  it("places stops without scheduledStartAt at the end", () => {
    const stops = [
      makeStop({ index: 3, scheduledStartAt: "2026-06-22T20:00:00.000Z" }),
      makeStop({ index: 4, scheduledStartAt: null }),
      makeStop({ index: 1, scheduledStartAt: "2026-06-22T17:00:00.000Z" }),
    ];

    const result = sortStopsChronologically(stops);

    assert.deepEqual(result.map((s) => s.index), [1, 3, 4]);
  });

  it("does not mutate input array", () => {
    const stops = [
      makeStop({ index: 3, scheduledStartAt: "2026-06-22T20:00:00.000Z" }),
      makeStop({ index: 1, scheduledStartAt: "2026-06-22T17:00:00.000Z" }),
    ];
    const originalOrder = stops.map((s) => s.index);

    sortStopsChronologically(stops);

    assert.deepEqual(stops.map((s) => s.index), originalOrder);
  });
});
