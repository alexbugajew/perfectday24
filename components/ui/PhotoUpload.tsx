"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhotoUploadProps = {
  folder: string;
  value: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
};

type UploadState = { status: "idle" | "uploading" | "error"; progress: number; error?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "partner-media";

function fileExt(file: File): string {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

function uuid(): string {
  return crypto.randomUUID();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhotoUpload({ folder, value, onChange, maxPhotos = 5 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", progress: 0 });
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canAdd = value.length < maxPhotos;

  async function upload(files: FileList | File[]) {
    const fileArr = Array.from(files);
    const slots = maxPhotos - value.length;
    const toUpload = fileArr.slice(0, slots);

    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadState({ status: "error", progress: 0, error: `Ungültiger Dateityp: ${file.name}` });
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setUploadState({ status: "error", progress: 0, error: `Datei zu groß (max. 5 MB): ${file.name}` });
        return;
      }
    }

    setUploadState({ status: "uploading", progress: 0 });
    const newUrls: string[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      const path = `${folder}/${uuid()}.${fileExt(file)}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        setUploadState({ status: "error", progress: 0, error: error.message });
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
      setUploadState({ status: "uploading", progress: Math.round(((i + 1) / toUpload.length) * 100) });
    }

    onChange([...value, ...newUrls]);
    setUploadState({ status: "idle", progress: 0 });
  }

  async function remove(url: string) {
    setDeleting(url);
    const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1];
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
    onChange(value.filter((u) => u !== url));
    setDeleting(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {/* ── Thumbnails ──────────────────────────────────────────────────────── */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={url}
              className="relative overflow-hidden rounded-[18px] border border-[var(--line-subtle)] bg-[var(--bg-surface)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Bild ${i + 1}`} className="h-20 w-28 object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  Titelbild
                </span>
              )}
              <button
                type="button"
                disabled={deleting === url}
                onClick={() => remove(url)}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                aria-label="Bild entfernen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Drop zone ───────────────────────────────────────────────────────── */}
      {canAdd && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging
              ? "border-[var(--text-strong)] bg-[var(--bg-surface)]"
              : "border-[var(--line-subtle)] hover:border-[var(--text-strong)] hover:bg-[var(--bg-surface)]"
          }`}
        >
          <svg
            className="h-7 w-7 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 10l-4-4m0 0L8 10m4-4v12"
            />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">
            Klicken oder Dateien hierher ziehen
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            JPG, PNG, WEBP · max. 5 MB · noch {maxPhotos - value.length} Foto{maxPhotos - value.length !== 1 ? "s" : ""}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* ── Progress / Error ────────────────────────────────────────────────── */}
      {uploadState.status === "uploading" && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--brand-accent)] transition-all"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">Hochladen … {uploadState.progress}%</p>
        </div>
      )}
      {uploadState.status === "error" && (
        <p className="text-xs text-red-600">{uploadState.error}</p>
      )}
    </div>
  );
}
