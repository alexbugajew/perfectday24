"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type SubmissionEntityType =
  | "route"
  | "route_stop"
  | "roadtrip"
  | "event_plan"
  | "partner_profile"
  | "service_provider";

type StopOption = {
  id: string;
  label: string;
};

type CommunityPhotoPreviewItem = {
  id: string;
  url: string;
  alt?: string | null;
};

type CommunityPhotoSubmissionProps = {
  entityType: SubmissionEntityType | "route_with_stops";
  entityId: string;
  title?: string;
  subtitle?: string;
  stopOptions?: StopOption[];
  previewItems?: CommunityPhotoPreviewItem[];
  partnerProfileId?: string | null;
  onSubmitted?: () => void | Promise<void>;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUCKET = "user-media";

function extensionOf(file: File) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

function fileLabel(count: number) {
  return count === 1 ? "Foto" : "Fotos";
}

export default function CommunityPhotoSubmission({
  entityType,
  entityId,
  title = "Foto beisteuern",
  subtitle = "Teile Bilder zu Route, Stop oder Anlass. Neue Uploads landen zuerst in der Pruefung.",
  stopOptions = [],
  previewItems = [],
  partnerProfileId = null,
  onSubmitted,
}: CommunityPhotoSubmissionProps) {
  const [caption, setCaption] = useState("");
  const [creditName, setCreditName] = useState("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);

  const modeOptions = useMemo(() => {
    if (entityType !== "route_with_stops" || stopOptions.length === 0) return [];
    return [{ id: "", label: "Zur ganzen Route" }, ...stopOptions];
  }, [entityType, stopOptions]);
  const isRouteTargetSelectionVisible = modeOptions.length > 0;

  useEffect(() => {
    if (!isDialogOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDialogOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  useEffect(() => {
    if (activePreviewIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePreviewIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActivePreviewIndex((current) => {
          if (current === null || previewItems.length <= 1) return current;
          return (current - 1 + previewItems.length) % previewItems.length;
        });
        return;
      }
      if (event.key === "ArrowRight") {
        setActivePreviewIndex((current) => {
          if (current === null || previewItems.length <= 1) return current;
          return (current + 1) % previewItems.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePreviewIndex, previewItems]);

  const galleryItems = useMemo(() => {
    const minimumSlots = 8;
    const sourceItems = previewItems.slice(0, Math.max(previewItems.length, minimumSlots));

    if (sourceItems.length >= minimumSlots) {
      return sourceItems;
    }

    return [
      ...sourceItems,
      ...Array.from({ length: minimumSlots - sourceItems.length }, (_, index) => ({
        id: `placeholder-${index}`,
        url: "",
        alt: null,
      })),
    ];
  }, [previewItems]);

  const activePreviewItem = activePreviewIndex !== null ? previewItems[activePreviewIndex] : null;

  function openPreview(index: number) {
    if (!previewItems[index]) return;
    setActivePreviewIndex(index);
  }

  function closePreview() {
    setActivePreviewIndex(null);
  }

  function showPreviousPreview() {
    if (previewItems.length <= 1) return;
    setActivePreviewIndex((current) => {
      if (current === null) return 0;
      return (current - 1 + previewItems.length) % previewItems.length;
    });
  }

  function showNextPreview() {
    if (previewItems.length <= 1) return;
    setActivePreviewIndex((current) => {
      if (current === null) return 0;
      return (current + 1) % previewItems.length;
    });
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(null);
    setSuccess(null);

    if (files.length === 0) return;
    if (!rightsConfirmed) {
      setError("Bitte bestaetige die Nutzungsrechte vor dem Upload.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setError("Bitte melde dich an, um Bilder hochzuladen.");
      return;
    }

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`Dateityp nicht unterstuetzt: ${file.name}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`Datei zu gross: ${file.name}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      for (const file of files) {
        const storagePath = `${session.user.id}/${entityType}/${entityId}/${crypto.randomUUID()}.${extensionOf(file)}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
          upsert: false,
          contentType: file.type,
        });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const publicUrl = publicUrlData.publicUrl;

        const { data: mediaAsset, error: assetError } = await supabase
          .from("media_assets")
          .insert({
            owner_user_id: session.user.id,
            partner_profile_id: partnerProfileId,
            source_type: partnerProfileId ? "partner" : "user",
            bucket_id: BUCKET,
            storage_path: storagePath,
            public_url: publicUrl,
            mime_type: file.type,
            file_size_bytes: file.size,
            caption: caption.trim() || null,
            credit_name: creditName.trim() || null,
            moderation_status: "submitted",
            rights_status: "confirmed",
            visibility: "public",
            consent_version: "media-v1",
            consent_confirmed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (assetError || !mediaAsset?.id) throw assetError ?? new Error("Asset konnte nicht angelegt werden.");

        const targetType = entityType === "route_with_stops" ? (selectedStopId ? "route_stop" : "route") : entityType;
        const attachmentTable =
          targetType === "route"
            ? "route_media"
            : targetType === "route_stop"
              ? "route_stop_media"
              : targetType === "roadtrip"
                ? "roadtrip_media"
                : targetType === "event_plan"
                  ? "event_plan_media"
                  : targetType === "partner_profile"
                    ? "partner_profile_media"
                    : "service_provider_media";

        const payload =
          targetType === "route"
            ? { route_id: entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false }
            : targetType === "route_stop"
              ? { route_stop_id: selectedStopId || entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false }
              : targetType === "roadtrip"
                ? { roadtrip_route_id: entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false }
                : targetType === "event_plan"
                  ? { event_plan_id: entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false }
                  : targetType === "partner_profile"
                    ? { partner_profile_id: entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false }
                    : { provider_id: entityId, asset_id: mediaAsset.id, role: "gallery", is_primary: false };

        const { error: attachError } = await supabase.from(attachmentTable).insert(payload as never);
        if (attachError) throw attachError;
      }

      setCaption("");
      setCreditName("");
      setSelectedStopId("");
      setSuccess(`${files.length} ${fileLabel(files.length)} eingereicht. Nach der Freigabe erscheinen sie in der Galerie.`);
      if (onSubmitted) await onSubmitted();
      setIsDialogOpen(false);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="relative rounded-[28px] border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
              {previewItems.length || 0} Bilder
            </div>
          </div>
        </div>

        <div
          className="overflow-x-auto overflow-y-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-2"
        >
          <div className="grid auto-cols-[8.5rem] grid-flow-col grid-rows-2 gap-2 sm:auto-cols-[9.5rem] lg:auto-cols-[10.25rem]">
            {galleryItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPreview(index)}
                disabled={!item.url}
                className={[
                  "relative aspect-square overflow-hidden rounded-[18px] border border-[rgba(15,23,42,0.05)] bg-white text-left",
                  item.url
                    ? "cursor-pointer transition hover:border-[rgba(23,23,23,0.16)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                    : "cursor-default",
                ].join(" ")}
                aria-label={item.url ? `Bild ${index + 1} ansehen` : "Leerer Bildplatz"}
              >
                {item.url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt || `Community-Foto ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.22))]" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#eef2f7)]">
                    <div className="h-8 w-8 rounded-full border border-[var(--line-subtle)] bg-white/90" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setIsDialogOpen(true);
          }}
          className="absolute bottom-7 right-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text-strong)] text-3xl font-light text-white shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition hover:scale-[1.03] hover:opacity-92"
          aria-label="Foto hochladen"
        >
          +
        </button>
      </section>

      {isDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.62)] px-4 py-6"
          onClick={() => setIsDialogOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[30px] border border-[rgba(255,255,255,0.18)] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-xl leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                aria-label="Upload-Fenster schliessen"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.9fr)]">
              <div className="space-y-3">
                {isRouteTargetSelectionVisible ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Bildziel
                    </span>
                    <select
                      value={selectedStopId}
                      onChange={(event) => setSelectedStopId(event.target.value)}
                      className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                    >
                      {modeOptions.map((option) => (
                        <option key={option.id || "route"} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Kurze Notiz
                  </span>
                  <input
                    type="text"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="z. B. Sonnenuntergang am Hauptspot"
                    className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Beitragender Name
                  </span>
                  <input
                    type="text"
                    value={creditName}
                    onChange={(event) => setCreditName(event.target.value)}
                    placeholder="Optionaler Name fuer die Bildquelle"
                    className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                  />
                </label>

                <div>
                  <div className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Bilddateien
                  </div>
                  <label className="flex cursor-pointer flex-col rounded-[24px] border-2 border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-6 transition hover:border-[rgba(23,23,23,0.18)] hover:bg-white">
                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                      {submitting ? "Bilder werden hochgeladen..." : "Fotos auswaehlen"}
                    </span>
                    <span className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      JPG, PNG oder WEBP bis 10 MB pro Datei. Mehrere Bilder koennen in einem Schritt hochgeladen werden.
                    </span>
                    <span className="mt-4 inline-flex w-fit rounded-full bg-[var(--text-strong)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                      {submitting ? "Upload laeuft..." : "Dateien waehlen"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => void handleUpload(event)}
                      disabled={submitting}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">Rechte und Freigabe</div>
                <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(event) => setRightsConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--line-subtle)]"
                  />
                  <span>
                    Ich bestaetige, dass ich dieses Bild hochladen darf und dass keine Rechte Dritter verletzt werden.
                  </span>
                </label>
                <div className="mt-4 rounded-[18px] border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Nach dem Upload</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Neue Bilder werden moderiert und erscheinen erst nach Freigabe in Route, Stop oder Event-Galerie.
                  </div>
                </div>
                <div className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
                  Unscharfe, irrelevante oder doppelte Bilder werden nicht freigeschaltet.
                </div>
                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  Nicht eingeloggt?{" "}
                  <Link href="/profile" className="font-medium text-[var(--text-strong)] underline underline-offset-2">
                    Zum Login
                  </Link>
                </div>
              </div>
            </div>

            {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
          </div>
        </div>
      ) : null}

      {activePreviewItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.82)] px-4 py-6"
          onClick={closePreview}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/12 bg-[#0f172a] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{title}</div>
                <div className="mt-1 text-sm text-white/76">
                  Bild {activePreviewIndex! + 1} von {previewItems.length}
                </div>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/16 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/14"
                aria-label="Vorschau schliessen"
              >
                Schliessen
              </button>
            </div>

            <div className="relative bg-[#0f172a] px-4 py-4 sm:px-6">
              {previewItems.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPreviousPreview}
                    className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/16 bg-black/28 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/46"
                    aria-label="Vorheriges Bild"
                  >
                    Zurueck
                  </button>
                  <button
                    type="button"
                    onClick={showNextPreview}
                    className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/16 bg-black/28 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/46"
                    aria-label="Naechstes Bild"
                  >
                    Weiter
                  </button>
                </>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewItem.url}
                alt={activePreviewItem.alt || `${title} Bild ${activePreviewIndex! + 1}`}
                className="max-h-[72vh] w-full rounded-[22px] object-contain bg-[#0b1222]"
              />
            </div>

            {previewItems.length > 1 ? (
              <div className="border-t border-white/10 px-5 py-5">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {previewItems.map((item, index) => {
                    const isActive = index === activePreviewIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openPreview(index)}
                        className={[
                          "group relative h-20 w-24 shrink-0 overflow-hidden rounded-[18px] border transition",
                          isActive
                            ? "border-white/60 ring-2 ring-white/26"
                            : "border-white/12 opacity-80 hover:border-white/28 hover:opacity-100",
                        ].join(" ")}
                        aria-label={`Bild ${index + 1} anzeigen`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.alt || `${title} Bild ${index + 1}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
