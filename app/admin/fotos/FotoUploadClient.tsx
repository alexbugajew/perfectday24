"use client";

// Batch-Upload eigener Location-Fotos (1–30 pro Durchgang).
//
// Ablauf pro Foto: EXIF-GPS im Browser auslesen (exifr) → Kandidaten im
// Umkreis vom Server holen → sicherer Treffer wird vorausgewählt, alles
// andere braucht einen Klick. Vor dem Upload wird das Bild per Canvas auf
// Web-Größe verkleinert — das hält den Request unter dem Vercel-Limit und
// entfernt nebenbei die EXIF-Daten (GPS bleibt nicht in der Public-URL).

import { useCallback, useRef, useState } from "react";
import exifr from "exifr";
import {
  autoSelectCandidate,
  rankCandidatesByDistance,
  type RankedCandidate,
} from "@/lib/admin/photo-matching";
import { EVENT_SUPPORTED_CITY_OPTIONS } from "@/lib/cities/planner-support";

const MAX_BATCH = 30;
const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.85;

type CandidateFromApi = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  hasOwnPhoto: boolean;
};

type PhotoItem = {
  key: string;
  file: File;
  previewUrl: string;
  gps: { lat: number; lng: number } | null;
  candidates: (RankedCandidate & { hasOwnPhoto?: boolean })[];
  selectedId: string | null;
  autoSelected: boolean;
  searchTerm: string;
  status: "vorbereitet" | "lädt-kandidaten" | "bereit" | "lädt-hoch" | "fertig" | "fehler";
  message: string | null;
  routeStopsFilled: number;
};

function itemKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/** Bild dekodieren, auf Web-Größe verkleinern, als JPEG (ohne EXIF) zurückgeben. */
async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG-Kodierung fehlgeschlagen"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export default function FotoUploadClient() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [citySlug, setCitySlug] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // citySlug zum Zeitpunkt des Kandidaten-Abrufs — State wäre in der
  // async-Schleife veraltet.
  const cityRef = useRef(citySlug);
  cityRef.current = citySlug;

  const patchItem = useCallback((key: string, patch: Partial<PhotoItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }, []);

  const loadCandidates = useCallback(
    async (key: string, gps: { lat: number; lng: number } | null, searchTerm?: string) => {
      patchItem(key, { status: "lädt-kandidaten", message: null });
      const params = new URLSearchParams();
      if (gps) {
        params.set("lat", String(gps.lat));
        params.set("lng", String(gps.lng));
      } else if (searchTerm && searchTerm.trim().length >= 2) {
        params.set("q", searchTerm.trim());
      } else {
        patchItem(key, {
          status: "bereit",
          candidates: [],
          selectedId: null,
          autoSelected: false,
          message: "Kein GPS im Foto — bitte über die Namenssuche zuordnen.",
        });
        return;
      }
      if (cityRef.current) params.set("city", cityRef.current);

      try {
        const res = await fetch(`/api/admin/location-photos?${params.toString()}`);
        const data = (await res.json()) as { candidates?: CandidateFromApi[]; error?: string };
        if (!res.ok || !data.candidates) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const usable = data.candidates.filter(
          (candidate): candidate is CandidateFromApi & { lat: number; lng: number } =>
            typeof candidate.lat === "number" && typeof candidate.lng === "number"
        );
        const ranked = gps
          ? rankCandidatesByDistance(gps, usable)
          : usable.map((candidate) => ({ ...candidate, distanceM: -1 }));
        const withPhotoFlag = ranked.map((candidate) => ({
          ...candidate,
          hasOwnPhoto: usable.find((entry) => entry.id === candidate.id)?.hasOwnPhoto ?? false,
        }));
        const autoId = gps ? autoSelectCandidate(withPhotoFlag) : null;
        patchItem(key, {
          status: "bereit",
          candidates: withPhotoFlag,
          selectedId: autoId,
          autoSelected: Boolean(autoId),
          message:
            withPhotoFlag.length === 0
              ? gps
                ? "Keine Location im Umkreis von ~700 m gefunden."
                : "Kein Treffer — anderen Suchbegriff versuchen."
              : null,
        });
      } catch (error) {
        patchItem(key, {
          status: "fehler",
          message: error instanceof Error ? error.message : "Kandidaten-Suche fehlgeschlagen.",
        });
      }
    },
    [patchItem]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const accepted = Array.from(files)
        .filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type))
        .slice(0, MAX_BATCH);

      const fresh: PhotoItem[] = accepted.map((file) => ({
        key: itemKey(file),
        file,
        previewUrl: URL.createObjectURL(file),
        gps: null,
        candidates: [],
        selectedId: null,
        autoSelected: false,
        searchTerm: "",
        status: "vorbereitet",
        message: null,
        routeStopsFilled: 0,
      }));

      setItems((current) => {
        const known = new Set(current.map((item) => item.key));
        return [...current, ...fresh.filter((item) => !known.has(item.key))];
      });

      for (const item of fresh) {
        let gps: { lat: number; lng: number } | null = null;
        try {
          const parsed = await exifr.gps(item.file);
          if (
            parsed &&
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude) &&
            (parsed.latitude !== 0 || parsed.longitude !== 0)
          ) {
            gps = { lat: parsed.latitude, lng: parsed.longitude };
          }
        } catch {
          gps = null;
        }
        patchItem(item.key, { gps });
        await loadCandidates(item.key, gps);
      }
    },
    [loadCandidates, patchItem]
  );

  const uploadItem = useCallback(
    async (item: PhotoItem) => {
      if (!item.selectedId) return;
      patchItem(item.key, { status: "lädt-hoch", message: null });
      try {
        const blob = await downscaleToJpeg(item.file);
        const selected = item.candidates.find((candidate) => candidate.id === item.selectedId);
        const body = new FormData();
        body.append("file", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        body.append("locationId", item.selectedId);
        body.append("altText", selected?.name ?? "");
        body.append("matchedBy", item.autoSelected ? "gps" : "manual");
        if (item.gps) {
          body.append("gpsLat", String(item.gps.lat));
          body.append("gpsLng", String(item.gps.lng));
        }
        const res = await fetch("/api/admin/location-photos", { method: "POST", body });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          routeStopsFilled?: number;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        patchItem(item.key, {
          status: "fertig",
          routeStopsFilled: data.routeStopsFilled ?? 0,
          message: null,
        });
      } catch (error) {
        patchItem(item.key, {
          status: "fehler",
          message: error instanceof Error ? error.message : "Upload fehlgeschlagen.",
        });
      }
    },
    [patchItem]
  );

  const uploadAllReady = useCallback(async () => {
    setUploadingAll(true);
    try {
      // Snapshot statt State-Referenz: Uploads laufen nacheinander, damit
      // 30 parallele Requests nicht das Vercel-Limit oder die DB treffen.
      let snapshot: PhotoItem[] = [];
      setItems((current) => {
        snapshot = current;
        return current;
      });
      for (const item of snapshot) {
        if (item.status === "bereit" && item.selectedId) {
          await uploadItem(item);
        }
      }
    } finally {
      setUploadingAll(false);
    }
  }, [uploadItem]);

  const readyCount = items.filter((item) => item.status === "bereit" && item.selectedId).length;
  const doneCount = items.filter((item) => item.status === "fertig").length;
  const stopsFilledTotal = items.reduce((sum, item) => sum + item.routeStopsFilled, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Admin · Datenpflege
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Location-Fotos hochladen</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
        Bis zu {MAX_BATCH} Fotos auf einmal. Die Zuordnung läuft über die GPS-Daten im Foto —
        sichere Treffer sind vorausgewählt, alles andere bestätigst du per Klick. Fotos ohne GPS
        bekommen eine Namenssuche.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="stadt-filter">
          Stadt (optional, engt Vorschläge ein):
        </label>
        <input
          id="stadt-filter"
          list="stadt-optionen"
          className="rounded-lg border border-[rgba(68,57,46,0.2)] bg-white px-3 py-1.5 text-sm"
          placeholder="alle Städte"
          value={EVENT_SUPPORTED_CITY_OPTIONS.find((c) => c.slug === citySlug)?.name ?? citySlug}
          onChange={(event) => {
            const value = event.target.value;
            const match = EVENT_SUPPORTED_CITY_OPTIONS.find(
              (c) => c.name === value || c.slug === value
            );
            setCitySlug(match ? match.slug : value === "" ? "" : citySlug);
          }}
        />
        <datalist id="stadt-optionen">
          {EVENT_SUPPORTED_CITY_OPTIONS.map((city) => (
            <option key={city.slug} value={city.name} />
          ))}
        </datalist>
      </div>

      <div
        className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? "border-[var(--accent,#b05c22)] bg-[rgba(176,92,34,0.05)]"
            : "border-[rgba(68,57,46,0.25)]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        <p className="text-sm">Fotos hierher ziehen (JPEG, PNG, WebP)</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          iPhone-HEIC vorher als JPEG exportieren — der Browser kann HEIC nicht anzeigen.
        </p>
        <button
          type="button"
          className="mt-4 rounded-full border border-[rgba(68,57,46,0.3)] px-5 py-2 text-sm font-medium"
          onClick={() => inputRef.current?.click()}
        >
          … oder Dateien auswählen
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={readyCount === 0 || uploadingAll}
            className="rounded-full bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void uploadAllReady()}
          >
            {uploadingAll ? "Lädt hoch …" : `${readyCount} bestätigte Fotos hochladen`}
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            {doneCount} von {items.length} fertig
            {stopsFilledTotal > 0 ? ` · ${stopsFilledTotal} Routen-Stops mitversorgt` : ""}
          </span>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-col gap-4 rounded-2xl border border-[rgba(68,57,46,0.12)] bg-white p-4 sm:flex-row"
          >
            {/* Objekt-URL-Vorschau: next/image kann blob:-URLs nicht optimieren */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt=""
              className="h-32 w-44 flex-shrink-0 rounded-xl border border-[rgba(68,57,46,0.1)] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.file.name}</span>
                <span
                  className={`text-xs font-semibold ${
                    item.status === "fertig"
                      ? "text-green-700"
                      : item.status === "fehler"
                        ? "text-red-700"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {item.status === "fertig"
                    ? `✓ hochgeladen${item.routeStopsFilled > 0 ? ` · ${item.routeStopsFilled} Stops versorgt` : ""}`
                    : item.status === "fehler"
                      ? "Fehler"
                      : item.status === "lädt-hoch"
                        ? "lädt hoch …"
                        : item.status === "lädt-kandidaten"
                          ? "sucht Kandidaten …"
                          : item.gps
                            ? "GPS gefunden"
                            : "kein GPS"}
                </span>
              </div>

              {item.message && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">{item.message}</p>
              )}

              {item.status !== "fertig" && !item.gps && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="w-full max-w-xs rounded-lg border border-[rgba(68,57,46,0.2)] px-3 py-1.5 text-sm"
                    placeholder="Location-Name suchen …"
                    value={item.searchTerm}
                    onChange={(event) => patchItem(item.key, { searchTerm: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void loadCandidates(item.key, null, item.searchTerm);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-[rgba(68,57,46,0.3)] px-3 py-1.5 text-sm"
                    onClick={() => void loadCandidates(item.key, null, item.searchTerm)}
                  >
                    Suchen
                  </button>
                </div>
              )}

              {item.status !== "fertig" && item.candidates.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() =>
                        patchItem(item.key, { selectedId: candidate.id, autoSelected: false })
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        item.selectedId === candidate.id
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-[rgba(68,57,46,0.25)] bg-white hover:border-[#171717]"
                      }`}
                      title={candidate.city_slug ?? undefined}
                    >
                      {candidate.name}
                      {candidate.distanceM >= 0 ? ` · ${candidate.distanceM} m` : ""}
                      {candidate.hasOwnPhoto ? " · 📷 hat Foto" : ""}
                    </button>
                  ))}
                </div>
              )}

              {item.status === "bereit" && item.selectedId && (
                <button
                  type="button"
                  className="mt-3 rounded-full bg-[#171717] px-4 py-1.5 text-xs font-semibold text-white"
                  onClick={() => {
                    let target: PhotoItem | undefined;
                    setItems((current) => {
                      target = current.find((candidate) => candidate.key === item.key);
                      return current;
                    });
                    if (target) void uploadItem(target);
                  }}
                >
                  Dieses Foto hochladen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="mt-10 text-center text-sm text-[var(--text-muted)]">
          Noch keine Fotos ausgewählt.
        </p>
      )}
    </main>
  );
}
