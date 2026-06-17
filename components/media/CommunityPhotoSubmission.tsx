"use client";

import { useMemo, useState } from "react";
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

type CommunityPhotoSubmissionProps = {
  entityType: SubmissionEntityType | "route_with_stops";
  entityId: string;
  title?: string;
  subtitle?: string;
  stopOptions?: StopOption[];
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

  const modeOptions = useMemo(() => {
    if (entityType !== "route_with_stops" || stopOptions.length === 0) return [];
    return [{ id: "", label: "Zur ganzen Route" }, ...stopOptions];
  }, [entityType, stopOptions]);

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
      setSuccess(`${files.length} ${fileLabel(files.length)} eingereicht. Nach der Freigabe erscheinen sie in der Galerie.`);
      if (onSubmitted) await onSubmitted();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
          Status: in Pruefung
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="space-y-3">
          {modeOptions.length > 0 ? (
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
        </div>

        <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="text-sm font-semibold text-[var(--text-strong)]">Trust & Rechte</div>
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
          <div className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
            Unscharfe, irrelevante oder doppelte Bilder werden nicht freigeschaltet. Rechteprobleme koennen spaeter gemeldet und entfernt werden.
          </div>
          <div className="mt-4 text-xs text-[var(--text-muted)]">
            Nicht eingeloggt? <Link href="/profile" className="font-medium text-[var(--text-strong)] underline underline-offset-2">Zum Login</Link>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-full bg-[var(--text-strong)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          {submitting ? "Wird hochgeladen..." : "Foto auswaehlen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => void handleUpload(event)}
            disabled={submitting}
            className="sr-only"
          />
        </label>
        <div className="text-xs text-[var(--text-muted)]">JPG, PNG oder WEBP bis 10 MB pro Datei.</div>
      </div>

      {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
    </section>
  );
}
