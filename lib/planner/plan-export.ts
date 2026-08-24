// Premium-Export für Tagespläne: Kalender (.ics) und druckoptimierte
// PDF-Ansicht (Browser-Druckdialog → "Als PDF speichern").
// Client-only: nutzt Blob-Downloads bzw. window.open.

import type { PlannedStop } from "@/lib/planner";

export type PlanExportInput = {
  title: string;
  cityLabel: string | null;
  planDate: string | null; // YYYY-MM-DD
  stops: PlannedStop[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIcsUtc(iso: string) {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function stopDisplayName(stop: PlannedStop) {
  return stop.item?.name?.trim() || stop.label || `Stop ${stop.index + 1}`;
}

function formatClock(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPlanDateLabel(planDate: string | null) {
  if (!planDate) return null;
  const d = new Date(`${planDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return planDate;
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function buildPlanIcs(input: PlanExportInput): string {
  const now = new Date();
  const dtstamp = toIcsUtc(now.toISOString());
  const timedStops = input.stops.filter((stop) => stop.scheduledStartAt && stop.scheduledEndAt);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PerfectDay24//Tagesplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const uidBase = `${(input.planDate ?? "plan").replace(/[^0-9a-z-]/gi, "")}-${now.getTime()}`;

  if (timedStops.length > 0) {
    for (const stop of timedStops) {
      const summary = stopDisplayName(stop);
      const descriptionParts = [stop.hint, stop.reasons?.[0]].filter(
        (part): part is string => typeof part === "string" && part.trim().length > 0
      );
      // Ort so konkret wie verfügbar: "Stop-Name, Stadt" lässt sich von
      // Kalender-Apps geocoden; GEO + Maps-Link liefern die exakte Position.
      const lat = stop.item?.lat;
      const lng = stop.item?.lng;
      const hasCoords = typeof lat === "number" && typeof lng === "number";
      const locationLabel = [stop.item?.name?.trim(), input.cityLabel]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(", ");
      const reservationUrl = stop.item?.reservation_url?.trim();
      if (reservationUrl) {
        descriptionParts.push(`Reservieren: ${reservationUrl}`);
      }
      if (hasCoords) {
        descriptionParts.push(`Karte: https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      }
      lines.push(
        "BEGIN:VEVENT",
        `UID:pd24-${uidBase}-${stop.index}@perfectday24.de`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toIcsUtc(stop.scheduledStartAt as string)}`,
        `DTEND:${toIcsUtc(stop.scheduledEndAt as string)}`,
        `SUMMARY:${escapeIcs(summary)}`,
        ...(locationLabel ? [`LOCATION:${escapeIcs(locationLabel)}`] : []),
        ...(hasCoords ? [`GEO:${lat};${lng}`] : []),
        ...(descriptionParts.length > 0
          ? [`DESCRIPTION:${escapeIcs(descriptionParts.join(" — "))}`]
          : []),
        "END:VEVENT"
      );
    }
  } else if (input.planDate) {
    // Ohne Slot-Zeiten: ein ganztägiger Eintrag mit der Stop-Liste.
    const day = input.planDate.replace(/-/g, "");
    const description = input.stops
      .map((stop, i) => `${i + 1}. ${stopDisplayName(stop)}`)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:pd24-${uidBase}-day@perfectday24.de`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${escapeIcs(input.title)}`,
      ...(input.cityLabel ? [`LOCATION:${escapeIcs(input.cityLabel)}`] : []),
      `DESCRIPTION:${escapeIcs(description)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadPlanIcs(input: PlanExportInput) {
  const ics = buildPlanIcs(input);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `perfectday24-plan${input.planDate ? `-${input.planDate}` : ""}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Öffnet eine druckoptimierte Ansicht des Plans in einem neuen Fenster und
 * startet den Druckdialog — dort wählt der Nutzer "Als PDF speichern".
 */
export function openPlanPrintWindow(input: PlanExportInput) {
  // Kein "noopener": damit gäbe window.open null zurück und das neue Fenster
  // bliebe als leeres about:blank stehen — wir brauchen die Referenz zum
  // Schreiben des Inhalts. Gleiches Origin, Inhalt kommt von uns selbst.
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) return false;

  const dateLabel = formatPlanDateLabel(input.planDate);
  const metaLine = [input.cityLabel, dateLabel].filter(Boolean).join(" · ");

  const rows = input.stops
    .map((stop, i) => {
      const start = formatClock(stop.scheduledStartAt);
      const end = formatClock(stop.scheduledEndAt);
      const time = start && end ? `${start}–${end}` : start ?? "";
      const name = escapeHtml(stopDisplayName(stop));
      const note = [stop.hint, stop.reasons?.[0]]
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .slice(0, 1)
        .map(escapeHtml)
        .join("");
      const travel =
        typeof stop.travelMinFromPrev === "number" && stop.travelMinFromPrev > 0 && i > 0
          ? `+${stop.travelMinFromPrev} Min Weg`
          : "";
      const duration = typeof stop.durationMin === "number" ? `${stop.durationMin} Min vor Ort` : "";
      const metaBits = [travel, duration].filter(Boolean).join(" · ");
      const reservationUrl = stop.item?.reservation_url?.trim();
      const reservationLine = reservationUrl
        ? `<div class="meta">Reservieren: <a href="${escapeHtml(reservationUrl)}">${escapeHtml(reservationUrl)}</a></div>`
        : "";
      return `
        <li>
          <div class="time">${time}</div>
          <div class="body">
            <div class="name">${i + 1}. ${name}</div>
            ${note ? `<div class="note">${note}</div>` : ""}
            ${metaBits ? `<div class="meta">${metaBits}</div>` : ""}
            ${reservationLine}
          </div>
        </li>`;
    })
    .join("");

  printWindow.document.write(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)} – PerfectDay24</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #171717; padding: 40px 44px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: #171717; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
  .brand-name { font-weight: 600; letter-spacing: 0.01em; }
  .brand-sub { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8a8a; }
  h1 { margin-top: 26px; font-size: 26px; letter-spacing: -0.01em; }
  .meta-line { margin-top: 6px; color: #6b6b6b; font-size: 14px; }
  ol { list-style: none; margin-top: 26px; border-top: 1px solid #e5e5e5; }
  li { display: flex; gap: 18px; padding: 14px 0; border-bottom: 1px solid #ececec; break-inside: avoid; }
  .time { width: 96px; flex-shrink: 0; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14px; color: #171717; padding-top: 1px; }
  .name { font-weight: 600; font-size: 15px; }
  .note { margin-top: 3px; font-size: 13px; color: #555; line-height: 1.45; }
  .meta { margin-top: 4px; font-size: 12px; color: #8a8a8a; }
  footer { margin-top: 30px; font-size: 11px; color: #9a9a9a; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="brand">
    <div class="brand-mark">PD</div>
    <div>
      <div class="brand-name">PerfectDay24</div>
      <div class="brand-sub">Refined City Planning</div>
    </div>
  </div>
  <h1>${escapeHtml(input.title)}</h1>
  ${metaLine ? `<div class="meta-line">${escapeHtml(metaLine)}</div>` : ""}
  <ol>${rows}</ol>
  <footer>Erstellt mit perfectday24.de</footer>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
