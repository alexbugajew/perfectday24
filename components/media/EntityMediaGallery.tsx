"use client";

import { useEffect, useState } from "react";
import MediaReportDialog from "@/components/media/MediaReportDialog";

export type EntityMediaItem = {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  creditName?: string | null;
  sourceLabel?: string | null;
  badge?: string | null;
};

type EntityMediaGalleryProps = {
  title: string;
  subtitle?: string | null;
  items: EntityMediaItem[];
  emptyTitle?: string;
  emptyBody?: string;
  rightsHint?: string;
  className?: string;
};

function mediaMetaLine(item: EntityMediaItem) {
  const parts = [item.creditName, item.sourceLabel].filter(Boolean);
  return parts.join(" - ");
}

export default function EntityMediaGallery({
  title,
  subtitle,
  items,
  emptyTitle = "Noch keine Bilder verfuegbar",
  emptyBody = "Sobald erste Fotos freigegeben sind, erscheinen sie hier als Galerie.",
  rightsHint = "Community-Fotos werden vor der Freigabe geprueft. Mit dem Upload muessen Nutzungsrechte bestaetigt werden.",
  className,
}: EntityMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const hasMultipleItems = items.length > 1;

  function openLightbox(index: number) {
    setActiveIndex(index);
  }

  function closeLightbox() {
    setActiveIndex(null);
  }

  function showPrevious() {
    if (!hasMultipleItems) return;
    setActiveIndex((current) => {
      if (current === null) return 0;
      return (current - 1 + items.length) % items.length;
    });
  }

  function showNext() {
    if (!hasMultipleItems) return;
    setActiveIndex((current) => {
      if (current === null) return 0;
      return (current + 1) % items.length;
    });
  }

  useEffect(() => {
    if (activeIndex === null) return;
    if (!items[activeIndex]) {
      setActiveIndex(items.length > 0 ? items.length - 1 : null);
    }
  }, [activeIndex, items]);

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }
      if (event.key === "ArrowLeft") {
        showPrevious();
        return;
      }
      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, items.length]);

  if (items.length === 0) {
    return (
      <section
        className={[
          "rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]",
          className ?? "",
        ].join(" ")}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {title}
        </div>
        {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p> : null}
        <div className="mt-4 rounded-[22px] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-8 text-center">
          <div className="text-sm font-semibold text-[var(--text-strong)]">{emptyTitle}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{emptyBody}</p>
        </div>
      </section>
    );
  }

  const lead = items[0];
  const activeItem = activeIndex !== null ? items[activeIndex] : null;

  return (
    <>
      <section
        className={[
          "rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]",
          className ?? "",
        ].join(" ")}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {title}
            </div>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p> : null}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{items.length} Bild{items.length === 1 ? "" : "er"}</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="group relative overflow-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-left transition hover:border-[rgba(23,23,23,0.16)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.url}
              alt={lead.alt || title}
              className="h-[280px] w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:h-[360px]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0.55))]" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="flex flex-wrap items-center gap-2">
                {lead.badge ? (
                  <div className="inline-flex rounded-full border border-white/18 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                    {lead.badge}
                  </div>
                ) : null}
                <div className="inline-flex rounded-full border border-white/18 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/88 backdrop-blur-sm">
                  Galerie öffnen
                </div>
              </div>
              {lead.caption ? <div className="mt-3 text-lg font-semibold leading-tight">{lead.caption}</div> : null}
              {mediaMetaLine(lead) ? (
                <div className="mt-2 text-xs text-white/78">{mediaMetaLine(lead)}</div>
              ) : null}
            </div>
          </button>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {items.slice(1, 5).map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openLightbox(index + 1)}
                className="group overflow-hidden rounded-[22px] border border-[var(--line-subtle)] bg-white text-left transition hover:border-[rgba(23,23,23,0.16)]"
              >
                <div className="relative h-32 overflow-hidden bg-[var(--bg-surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.alt || item.caption || title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  {item.badge ? (
                    <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                      {item.badge}
                    </div>
                  ) : null}
                </div>
                <div className="px-3 py-3">
                  <div className="line-clamp-2 text-sm font-semibold text-[var(--text-strong)]">
                    {item.caption || item.alt || "Mehr ansehen"}
                  </div>
                  {mediaMetaLine(item) ? (
                    <div className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{mediaMetaLine(item)}</div>
                  ) : null}
                </div>
              </button>
            ))}
            {items.length > 5 ? (
              <button
                type="button"
                onClick={() => openLightbox(4)}
                className="flex min-h-[158px] items-center justify-center rounded-[22px] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 text-center transition hover:border-[rgba(23,23,23,0.16)]"
              >
                <div>
                  <div className="text-lg font-semibold text-[var(--text-strong)]">+{items.length - 4}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">Weitere Impressionen</div>
                </div>
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs leading-6 text-[var(--text-muted)]">
          {rightsHint}
        </div>
      </section>

      {activeIndex !== null && activeItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.82)] px-4 py-6"
          onClick={closeLightbox}
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/12 bg-[#0f172a] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{title}</div>
                <div className="mt-1 text-sm text-white/76">
                  Bild {activeIndex + 1} von {items.length}
                </div>
              </div>
              <button
                type="button"
                onClick={closeLightbox}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/16 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/14"
                aria-label="Galerie schließen"
              >
                Schließen
              </button>
            </div>

            <div className="relative bg-[#0f172a] px-4 py-4 sm:px-6">
              {hasMultipleItems ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevious}
                    className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/16 bg-black/28 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/46"
                    aria-label="Vorheriges Bild"
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/16 bg-black/28 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/46"
                    aria-label="Nächstes Bild"
                  >
                    Weiter
                  </button>
                </>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeItem.url}
                alt={activeItem.alt || activeItem.caption || title}
                className="max-h-[72vh] w-full rounded-[22px] object-contain bg-[#0b1222]"
              />
            </div>

            <div className="border-t border-white/10 px-5 py-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {activeItem.caption || activeItem.alt || title}
                  </div>
                  {mediaMetaLine(activeItem) ? (
                    <div className="mt-1 text-sm text-white/76">{mediaMetaLine(activeItem)}</div>
                  ) : null}
                </div>
                <div className="text-xs leading-6 text-white/60">
                  Klick außerhalb oder drücke Escape, um die Ansicht zu schließen.
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsReportDialogOpen(true)}
                  className="inline-flex items-center rounded-full border border-white/16 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/14"
                >
                  Bild melden
                </button>
              </div>

              {hasMultipleItems ? (
                <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                  {items.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openLightbox(index)}
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
                          alt={item.alt || item.caption || title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <MediaReportDialog
        assetId={activeItem?.id ?? null}
        assetLabel={activeItem?.caption || activeItem?.alt || title}
        open={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
      />
    </>
  );
}
