"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MediaReportDialog from "@/components/media/MediaReportDialog";

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

type OwnMediaSubmission = {
  id: string;
  url: string;
  caption: string | null;
  creditName: string | null;
  moderationStatus: "draft" | "submitted" | "approved" | "rejected" | "featured";
  createdAt: string;
  lastAction: string | null;
  lastNote: string | null;
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

const SUBMISSION_STATUS_META: Record<
  OwnMediaSubmission["moderationStatus"],
  { label: string; className: string }
> = {
  draft: {
    label: "Entwurf",
    className: "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  },
  submitted: {
    label: "In Pruefung",
    className: "pd24-status-info",
  },
  approved: {
    label: "Freigegeben",
    className: "pd24-status-success",
  },
  rejected: {
    label: "Abgelehnt",
    className: "pd24-status-error",
  },
  featured: {
    label: "Featured",
    className: "pd24-status-warning",
  },
};

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
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [ownSubmissions, setOwnSubmissions] = useState<OwnMediaSubmission[]>([]);
  const [isLoadingOwnSubmissions, setIsLoadingOwnSubmissions] = useState(false);

  const modeOptions = useMemo(() => {
    if (entityType !== "route_with_stops" || stopOptions.length === 0) return [];
    return [{ id: "", label: "Zur ganzen Route" }, ...stopOptions];
  }, [entityType, stopOptions]);
  const isRouteTargetSelectionVisible = modeOptions.length > 0;
  const isAnyOverlayOpen = isDialogOpen || activePreviewIndex !== null;

  useEffect(() => {
    if (!isAnyOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyOverlayOpen]);

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

  async function loadOwnSubmissions() {
    setIsLoadingOwnSubmissions(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setOwnSubmissions([]);
        return;
      }

      let assetIds: string[] = [];

      if (entityType === "route_with_stops") {
        const routeAssetResp = await supabase
          .from("route_media")
          .select("asset_id")
          .eq("route_id", entityId);
        if (routeAssetResp.error) throw routeAssetResp.error;

        const routeStopIds = stopOptions.map((option) => option.id).filter(Boolean);
        let stopAssetIds: string[] = [];

        if (routeStopIds.length > 0) {
          const stopAssetResp = await supabase
            .from("route_stop_media")
            .select("asset_id")
            .in("route_stop_id", routeStopIds);
          if (stopAssetResp.error) throw stopAssetResp.error;
          stopAssetIds = (stopAssetResp.data ?? []).map((row) => row.asset_id as string);
        }

        assetIds = [...(routeAssetResp.data ?? []).map((row) => row.asset_id as string), ...stopAssetIds];
      } else if (entityType === "route") {
        const resp = await supabase.from("route_media").select("asset_id").eq("route_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      } else if (entityType === "route_stop") {
        const resp = await supabase.from("route_stop_media").select("asset_id").eq("route_stop_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      } else if (entityType === "roadtrip") {
        const resp = await supabase.from("roadtrip_media").select("asset_id").eq("roadtrip_route_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      } else if (entityType === "event_plan") {
        const resp = await supabase.from("event_plan_media").select("asset_id").eq("event_plan_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      } else if (entityType === "partner_profile") {
        const resp = await supabase.from("partner_profile_media").select("asset_id").eq("partner_profile_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      } else if (entityType === "service_provider") {
        const resp = await supabase.from("service_provider_media").select("asset_id").eq("provider_id", entityId);
        if (resp.error) throw resp.error;
        assetIds = (resp.data ?? []).map((row) => row.asset_id as string);
      }

      const uniqueAssetIds = Array.from(new Set(assetIds));
      if (uniqueAssetIds.length === 0) {
        setOwnSubmissions([]);
        return;
      }

      const { data: assets, error: assetsError } = await supabase
        .from("media_assets")
        .select("id, public_url, caption, credit_name, moderation_status, created_at")
        .eq("owner_user_id", session.user.id)
        .in("id", uniqueAssetIds)
        .order("created_at", { ascending: false });
      if (assetsError) throw assetsError;

      const ownAssetIds = (assets ?? []).map((asset) => asset.id as string);
      if (ownAssetIds.length === 0) {
        setOwnSubmissions([]);
        return;
      }

      const { data: events, error: eventsError } = await supabase
        .from("media_moderation_events")
        .select("asset_id, action, note, created_at")
        .in("asset_id", ownAssetIds)
        .order("created_at", { ascending: false });
      if (eventsError) throw eventsError;

      const latestEventByAssetId = new Map<string, { action: string | null; note: string | null }>();
      for (const event of events ?? []) {
        const assetId = event.asset_id as string;
        if (!latestEventByAssetId.has(assetId)) {
          latestEventByAssetId.set(assetId, {
            action: typeof event.action === "string" ? event.action : null,
            note: typeof event.note === "string" ? event.note : null,
          });
        }
      }

      setOwnSubmissions(
        (assets ?? []).map((asset) => {
          const latestEvent = latestEventByAssetId.get(asset.id as string);
          return {
            id: asset.id as string,
            url: (asset.public_url as string) ?? "",
            caption: (asset.caption as string | null) ?? null,
            creditName: (asset.credit_name as string | null) ?? null,
            moderationStatus: (asset.moderation_status as OwnMediaSubmission["moderationStatus"]) ?? "submitted",
            createdAt: (asset.created_at as string) ?? new Date().toISOString(),
            lastAction: latestEvent?.action ?? null,
            lastNote: latestEvent?.note ?? null,
          };
        })
      );
    } catch (loadError) {
      console.error("community media submissions load failed:", loadError);
      setOwnSubmissions([]);
    } finally {
      setIsLoadingOwnSubmissions(false);
    }
  }

  useEffect(() => {
    void loadOwnSubmissions();
  }, [entityId, entityType, stopOptions]);

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
      await loadOwnSubmissions();
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
            <div className="pd24-meta">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
              {previewItems.length || 0} Bilder
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-2 pr-20 pb-20">
          <div className="grid auto-cols-[8.5rem] grid-flow-col grid-rows-2 gap-2 sm:auto-cols-[9.5rem] lg:auto-cols-[10.25rem]">
            {galleryItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPreview(index)}
                disabled={!item.url}
                className={[
                  "group relative aspect-square overflow-hidden rounded-[var(--radius-control)] border border-[rgba(15,23,42,0.05)] bg-white text-left",
                  item.url
                    ? "cursor-pointer transition hover:border-[var(--line-strong)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
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
                    <div className="absolute right-2 top-2 rounded-full border border-white/18 bg-black/28 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                      Vorschau
                    </div>
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

        <div className="pointer-events-none absolute bottom-6 right-6">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setIsDialogOpen(true);
            }}
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text-strong)] text-3xl font-light text-white shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition hover:scale-[1.03] hover:opacity-92"
            aria-label="Foto hochladen"
          >
            +
          </button>
        </div>

        <div className="mt-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="pd24-meta">
              Meine Uploads
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {isLoadingOwnSubmissions ? "wird geladen..." : `${ownSubmissions.length} Einreichungen`}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {ownSubmissions.length > 0 ? (
              ownSubmissions.slice(0, 4).map((submission) => {
                const statusMeta = SUBMISSION_STATUS_META[submission.moderationStatus] ?? SUBMISSION_STATUS_META.submitted;
                return (
                  <div
                    key={submission.id}
                    className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={submission.url}
                        alt={submission.caption || "Eingereichtes Bild"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium text-[var(--text-strong)]">
                          {submission.caption || "Foto ohne Titel"}
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {new Date(submission.createdAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                        {submission.creditName ? ` - ${submission.creditName}` : ""}
                      </div>
                      {submission.lastNote ? (
                        <div className="mt-2 rounded-[var(--radius-control)] pd24-status-warning px-3 py-2 text-xs leading-5">
                          {submission.lastNote}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--line-subtle)] px-4 py-4 text-sm text-[var(--text-muted)]">
                Eigene Einreichungen erscheinen hier mit Status, sobald du Bilder hochgeladen hast.
              </div>
            )}
          </div>
        </div>
      </section>

      {success ? <div className="mt-3 rounded-2xl pd24-status-success px-4 py-3 text-sm">{success}</div> : null}
      {error && !isDialogOpen ? <div className="mt-3 rounded-2xl pd24-status-error px-4 py-3 text-sm">{error}</div> : null}

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
                <div className="pd24-meta">{title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-xl leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                aria-label="Upload-Fenster schließen"
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
                  <label className="flex cursor-pointer flex-col rounded-[var(--radius-card)] border-2 border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-6 transition hover:border-[rgba(23,23,23,0.18)] hover:bg-white">
                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                      {submitting ? "Bilder werden hochgeladen..." : "Fotos auswählen"}
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

              <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
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
                <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="pd24-meta">Nach dem Upload</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Neue Bilder werden moderiert und erscheinen erst nach Freigabe in Route, Stop oder Event-Galerie.
                  </div>
                </div>
                <div className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
                  Unscharfe, irrelevante oder doppelte Bilder werden nicht freigeschaltet.
                </div>
                <div className="mt-4 text-xs text-[var(--text-muted)]">
                  Noch nicht angemeldet?{" "}
                  <Link href="/profile" className="font-medium text-[var(--text-strong)] underline underline-offset-2">
                    Jetzt anmelden
                  </Link>
                </div>
              </div>
            </div>

            {error ? <div className="mt-4 rounded-2xl pd24-status-error px-4 py-3 text-sm">{error}</div> : null}
            {success ? <div className="mt-4 rounded-2xl pd24-status-success px-4 py-3 text-sm">{success}</div> : null}
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
                aria-label="Vorschau schließen"
              >
                Schließen
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
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={showNextPreview}
                    className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/16 bg-black/28 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/46"
                    aria-label="Nächstes Bild"
                  >
                    Weiter
                  </button>
                </>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewItem.url}
                alt={activePreviewItem.alt || `${title} Bild ${activePreviewIndex! + 1}`}
                className="max-h-[72vh] w-full rounded-[var(--radius-card-sm)] object-contain bg-[#0b1222]"
              />
            </div>

            {previewItems.length > 1 ? (
            <div className="border-t border-white/10 px-5 py-5">
                <div className="mb-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReportDialogOpen(true)}
                    className="inline-flex items-center rounded-full border border-white/16 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/14"
                  >
                    Bild melden
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {previewItems.map((item, index) => {
                    const isActive = index === activePreviewIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openPreview(index)}
                        className={[
                          "group relative h-20 w-24 shrink-0 overflow-hidden rounded-[var(--radius-control)] border transition",
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

            {previewItems.length <= 1 ? (
              <div className="border-t border-white/10 px-5 py-5">
                <button
                  type="button"
                  onClick={() => setIsReportDialogOpen(true)}
                  className="inline-flex items-center rounded-full border border-white/16 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/14"
                >
                  Bild melden
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <MediaReportDialog
        assetId={activePreviewItem?.id ?? null}
        assetLabel={activePreviewItem?.alt || title}
        open={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
      />
    </>
  );
}
