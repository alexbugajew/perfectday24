// Regressionstest fuer den Auftakt vor einem Event am Stadtrand.
//
// Liegt der Anker in einer duennen Gegend — Arena, Messegelaende, Freilicht-
// buehne —, greift die Cluster-Policy: Sie laesst neben einem Essens-Slot nur
// gut drei Kilometer Abstand zum Anker zu und wirft alles Weitere hart raus.
// In Hamburg blieben zum DBB Super Cup damit genau ein Lokal im Radius uebrig,
// bei 210 im Pool — und der Auftakt blieb leer.
//
// Der Test stellt genau diese Geometrie synthetisch nach: Startpunkt und alle
// Lokale im Zentrum, das Event acht Kilometer draussen. Ohne den Pre-Show-
// Fallback liefert generatePlan hier zwei gefuellte Stops statt drei.
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { classify, generatePlan, plannerEventToLocationRow } from "../lib/planner";
import type { LocationRow, PlannerEventRow, PlannerRequest } from "../lib/planner/types";

const ORIGIN = { lat: 53.5528, lng: 10.0067 };
/** Rund acht Kilometer westlich — jenseits der Cluster-Grenze von 3,1 km +1,8 km. */
const ARENA = { lat: 53.5878, lng: 9.8985 };

function restaurant(id: string, lat: number, lng: number): LocationRow {
  return {
    id,
    name: `Lokal ${id}`,
    type: "restaurant",
    category: "restaurant",
    lat,
    lng,
    city_slug: "teststadt",
    is_plannable: true,
    dinner_fit: true,
    duration_min: 75,
    quality_score: 80,
    rating: 4.5,
    rating_count: 200,
    source_primary: "osm",
  };
}

function nightlife(id: string, lat: number, lng: number): LocationRow {
  return {
    id,
    name: `Bar ${id}`,
    type: "bar",
    category: "nightlife",
    lat,
    lng,
    city_slug: "teststadt",
    is_plannable: true,
    nightlife_fit: true,
    duration_min: 60,
    quality_score: 80,
    rating: 4.5,
    rating_count: 200,
    source_primary: "osm",
  };
}

/**
 * Bewusst ueber plannerEventToLocationRow gebaut statt von Hand: Der Anker
 * erkennt Events an genau den Feldern, die der Konverter setzt.
 */
function arenaEvent(): LocationRow {
  const row: PlannerEventRow = {
    id: "event-arena",
    source: "ticketmaster",
    external_id: "arena-1",
    title: "Grosses Spiel in der Arena",
    category: "concert",
    kind: "anchored_event",
    status: "scheduled",
    venue_name: "Arena am Stadtrand",
    city_slug: "teststadt",
    lat: ARENA.lat,
    lng: ARENA.lng,
    start_at: "2026-09-12T17:45:00+02:00",
    end_at: "2026-09-12T19:45:00+02:00",
    is_ticketed: true,
    importance_score: 90,
  };
  return plannerEventToLocationRow(row);
}

function buildRequest(): PlannerRequest {
  return {
    citySlug: "teststadt",
    planDate: "2026-09-12",
    selectedEventId: null,
    eventPlanningMode: "auto",
    startPoint: { type: "station", label: "Hauptbahnhof", lat: ORIGIN.lat, lng: ORIGIN.lng },
    planMode: "evening",
    radiusKm: 12,
    budget: "medium",
    occasion: "date",
    experienceMode: "show",
    eventStrictness: "required",
    interests: ["live music", "culture"],
    group: { enabled: false, members: [] },
    stopsCount: 3,
    sortMode: "match",
    routeProfile: "public_transit",
    evaluationMode: "trace",
  };
}

/** Lokale und Bars dicht am Startpunkt — also weit weg vom Anker. */
function centreLocations(): LocationRow[] {
  const rows: LocationRow[] = [];
  for (let i = 0; i < 6; i += 1) {
    rows.push(restaurant(`r${i}`, ORIGIN.lat + i * 0.002, ORIGIN.lng + i * 0.002));
    rows.push(nightlife(`n${i}`, ORIGIN.lat + i * 0.002, ORIGIN.lng - i * 0.002));
  }
  return rows;
}

describe("Auftakt vor einem Event am Stadtrand", () => {
  it("fuellt den Stop vor dem Anker, auch wenn im Cluster-Radius nichts liegt", () => {
    const result = generatePlan({
      request: buildRequest(),
      locations: [...centreLocations(), arenaEvent()],
    });

    const filled = result.plannedStops.filter((stop) => stop.item);
    assert.equal(filled.length, 3, "drei gefuellte Stops erwartet");

    const first = result.plannedStops[0];
    assert.ok(first.item, "der Auftakt darf nicht leer bleiben");
    assert.equal(
      classify(first.item!),
      "restaurant",
      "vor einem Abend-Date gehoert ein Lokal in den Auftakt"
    );
  });

  it("setzt das Event weiterhin als Anker in den Ablauf", () => {
    const result = generatePlan({
      request: buildRequest(),
      locations: [...centreLocations(), arenaEvent()],
    });

    const eventIndex = result.plannedStops.findIndex(
      (stop) => stop.item?.source_primary === "planner_event"
    );
    assert.ok(eventIndex >= 0, "das Event muss im Ablauf auftauchen");
    assert.ok(
      result.plannedStops.slice(eventIndex + 1).some((stop) => stop.item),
      "nach dem Event muss ein Ausklang folgen"
    );
  });

  it("nimmt kein Lokal, das in die Gegenrichtung zwingt", () => {
    // Ein Lokal acht Kilometer oestlich des Startpunkts liegt genauso weit vom
    // Anker weg wie die Innenstadt-Lokale — nur eben auf der falschen Seite.
    // Der Umweg waere rund sechzehn Kilometer und muss durchfallen.
    const wrongWay = restaurant("weit-weg", ORIGIN.lat, ORIGIN.lng + 0.24);
    const result = generatePlan({
      request: buildRequest(),
      locations: [...centreLocations(), wrongWay, arenaEvent()],
    });

    assert.notEqual(
      result.plannedStops[0].item?.id,
      "weit-weg",
      "ein Lokal in der Gegenrichtung gehoert nicht in den Auftakt"
    );
  });
});
