// lib/events/planner-href.ts
//
// Der Übergabepunkt von der Event-Strecke an den Planner — geteilt zwischen
// Detailseite und Event-Karte, damit beide denselben Deep Link bauen.

export function buildEventPlannerHref(params: {
  citySlug: string;
  eventId: string;
  /** Lokaler Kalendertag ("2026-10-16"), nicht das UTC-Datum. */
  planDate: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  venueName: string | null | undefined;
  title: string;
}): string {
  // Stadt, Datum, Event und der Modus, der die Event-Kandidaten überhaupt
  // lädt — dazu der Veranstaltungsort als Startpunkt. Ohne Startpunkt erzeugt
  // der Planner gar keinen Plan, ohne Plan gibt es keine Event-Kandidaten und
  // damit auch keinen Anker.
  const startParams =
    typeof params.lat === "number" && typeof params.lng === "number"
      ? `&startLat=${params.lat}&startLng=${params.lng}` +
        `&startLabel=${encodeURIComponent(params.venueName ?? params.title)}`
      : "";

  return (
    `/planner?citySlug=${encodeURIComponent(params.citySlug)}` +
    `&planDate=${params.planDate}` +
    `&eventId=${encodeURIComponent(params.eventId)}` +
    `&experienceMode=event_visit` +
    startParams
  );
}
