export function scoreContains(text: string, terms: string[], points: number) {
  return terms.some((term) => text.includes(term)) ? points : 0;
}

export function scoreTextSupport(
  text: string,
  terms: string[],
  points: number,
  hasStructuredEvidence = false
) {
  if (!terms.some((term) => text.includes(term))) return 0;
  if (!hasStructuredEvidence) return points;
  return Math.max(1, Math.floor(points / 2));
}

export function capSignal(value: number, max: number) {
  return Math.min(value, max);
}

export function capSignals<T extends Record<string, number>>(
  signals: T,
  caps: Partial<Record<keyof T, number>>
): T {
  const out = { ...signals } as T;

  for (const key of Object.keys(caps) as Array<keyof T>) {
    const max = caps[key];
    if (typeof max === "number") {
      out[key] = Math.min(out[key], max) as T[keyof T];
    }
  }

  return out;
}

export function hasStrongRating(
  loc: { rating?: number | null },
  min = 4.2
) {
  return typeof loc.rating === "number" && loc.rating >= min;
}

export function hasRatingVolume(
  loc: { rating_count?: number | null },
  min = 20
) {
  return typeof loc.rating_count === "number" && loc.rating_count >= min;
}

export function hasOpeningInfo(
  loc: { opening_hours_raw?: string | null }
) {
  return Boolean(loc.opening_hours_raw && String(loc.opening_hours_raw).trim());
}

export function dedupeReasons(reasons: Array<string | null | undefined>, limit = 4) {
  const out: string[] = [];

  for (const reason of reasons) {
    if (!reason) continue;
    const normalized = reason.trim();
    if (!normalized) continue;
    if (out.includes(normalized)) continue;
    out.push(normalized);
    if (out.length >= limit) break;
  }

  return out;
}
