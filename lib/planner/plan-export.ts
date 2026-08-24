// Premium-Export für Tagespläne: Kalender (.ics) und druckoptimierte
// PDF-Ansicht (Browser-Druckdialog → "Als PDF speichern").
// Client-only: nutzt Blob-Downloads bzw. window.open.

import type { PlannedStop } from "@/lib/planner";

/** Stop mit optionalem Bild für die Druckansicht (Planner: aufgelöste
 *  Stop-Fotos inkl. Fallback; Routen: photo_url des Stops). */
export type PlanExportStop = PlannedStop & { exportImageUrl?: string | null };

export type PlanExportInput = {
  title: string;
  cityLabel: string | null;
  planDate: string | null; // YYYY-MM-DD
  stops: PlanExportStop[];
  /** Öffentlicher Link zum Live-Plan (geteilter Plan bzw. Routen-URL). */
  shareUrl?: string | null;
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
  // Wie die Planner-Anzeige auf Europe/Berlin gepinnt (Wanduhr am Ort des Plans).
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
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
      if (input.shareUrl) {
        descriptionParts.push(`Ganzer Plan: ${input.shareUrl}`);
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

/** Baut das komplette Druck-HTML — separat testbar. */
export function buildPlanPrintHtml(input: PlanExportInput): string {
  const dateLabel = formatPlanDateLabel(input.planDate);
  const metaLine = [input.cityLabel, dateLabel, `${input.stops.length} Stops`]
    .filter(Boolean)
    .join(" · ");

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
      const lat = stop.item?.lat;
      const lng = stop.item?.lng;
      const hasCoords = typeof lat === "number" && typeof lng === "number";
      const mapsUrl = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null;
      const reservationUrl = stop.item?.reservation_url?.trim() || null;
      const links = [
        mapsUrl ? `<a class="chip" href="${escapeHtml(mapsUrl)}">📍 Navigation</a>` : "",
        reservationUrl ? `<a class="chip" href="${escapeHtml(reservationUrl)}">Reservieren</a>` : "",
      ]
        .filter(Boolean)
        .join("");
      const image = stop.exportImageUrl
        ? `<img class="thumb" src="${escapeHtml(stop.exportImageUrl)}" alt="" />`
        : "";
      return `
        <li>
          <div class="time"><span class="idx">${i + 1}</span>${time ? `<span class="clock">${time}</span>` : ""}</div>
          <div class="body">
            <div class="name">${name}</div>
            ${note ? `<div class="note">${note}</div>` : ""}
            ${metaBits ? `<div class="meta">${metaBits}</div>` : ""}
            ${links ? `<div class="links">${links}</div>` : ""}
            ${reservationUrl ? `<div class="url">Reservieren: ${escapeHtml(reservationUrl)}</div>` : ""}
            ${mapsUrl ? `<div class="url">Navigation: ${escapeHtml(mapsUrl)}</div>` : ""}
          </div>
          ${image}
        </li>`;
    })
    .join("");

  return `<!doctype html>
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
  .share { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e2ddd2; background: #faf8f3; border-radius: 12px; padding: 8px 14px; font-size: 12px; color: #444; }
  .share a { color: #171717; font-weight: 600; text-decoration: none; }
  ol { list-style: none; margin-top: 26px; border-top: 1px solid #e5e5e5; }
  li { display: flex; gap: 18px; padding: 16px 0; border-bottom: 1px solid #ececec; break-inside: avoid; align-items: flex-start; }
  .time { width: 96px; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; padding-top: 1px; }
  .idx { width: 24px; height: 24px; border-radius: 8px; background: #171717; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
  .clock { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px; color: #171717; }
  .body { flex: 1; min-width: 0; }
  .name { font-weight: 600; font-size: 15px; }
  .note { margin-top: 3px; font-size: 13px; color: #555; line-height: 1.45; }
  .meta { margin-top: 4px; font-size: 12px; color: #8a8a8a; }
  .links { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #d9d4c9; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 600; color: #171717; text-decoration: none; }
  .url { margin-top: 4px; font-size: 10.5px; color: #9a9a9a; word-break: break-all; }
  .thumb { width: 108px; height: 82px; flex-shrink: 0; object-fit: cover; border-radius: 12px; border: 1px solid #ececec; }
  footer { margin-top: 30px; font-size: 11px; color: #9a9a9a; }
  footer a { color: #6b6b6b; }
  @media print { body { padding: 0; } .chip { border-color: #bbb; } }
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
  ${
    input.shareUrl
      ? `<div class="share">Live-Plan öffnen &amp; teilen: <a href="${escapeHtml(input.shareUrl)}">${escapeHtml(input.shareUrl)}</a></div>`
      : ""
  }
  <ol>${rows}</ol>
  <footer>Erstellt mit perfectday24.de${input.shareUrl ? ` · Live-Version: <a href="${escapeHtml(input.shareUrl)}">${escapeHtml(input.shareUrl)}</a>` : ""}</footer>
  <script>
    // Erst drucken, wenn die Stop-Fotos geladen sind (max. 2,5s warten) —
    // sonst landen leere Bildrahmen im PDF.
    window.addEventListener("load", function () {
      var images = Array.prototype.slice.call(document.images);
      var pending = images.filter(function (img) { return !img.complete; });
      var done = false;
      function go() {
        if (done) return;
        done = true;
        setTimeout(function () { window.print(); }, 100);
      }
      if (pending.length === 0) { go(); return; }
      var left = pending.length;
      pending.forEach(function (img) {
        img.addEventListener("load", function () { if (--left <= 0) go(); });
        img.addEventListener("error", function () { if (--left <= 0) go(); });
      });
      setTimeout(go, 2500);
    });
  </script>
</body>
</html>`;
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

  printWindow.document.write(buildPlanPrintHtml(input));
  printWindow.document.close();
  return true;
}
