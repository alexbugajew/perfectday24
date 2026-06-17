"use client";

import { useState } from "react";

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
  return parts.join(" · ");
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
            onClick={() => setActiveIndex(0)}
            className="group relative overflow-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.url}
              alt={lead.alt || title}
              className="h-[280px] w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:h-[360px]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0.55))]" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              {lead.badge ? (
                <div className="inline-flex rounded-full border border-white/18 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                  {lead.badge}
                </div>
              ) : null}
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
                onClick={() => setActiveIndex(index + 1)}
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
                onClick={() => setActiveIndex(4)}
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

      {activeIndex !== null && items[activeIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.78)] px-4 py-6">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/12 bg-[#0f172a] shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-black/22 text-white transition hover:bg-black/40"
              aria-label="Galerie schliessen"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[activeIndex].url}
              alt={items[activeIndex].alt || items[activeIndex].caption || title}
              className="max-h-[78vh] w-full object-contain bg-[#0f172a]"
            />
            <div className="border-t border-white/10 px-5 py-4 text-white">
              <div className="text-lg font-semibold">
                {items[activeIndex].caption || items[activeIndex].alt || title}
              </div>
              {mediaMetaLine(items[activeIndex]) ? (
                <div className="mt-1 text-sm text-white/76">{mediaMetaLine(items[activeIndex])}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
