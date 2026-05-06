export function isLikelyOpen(params: {
  openingHoursRaw?: string | null;
  preferredDaytimes: string[];
}) {
  const { openingHoursRaw, preferredDaytimes } = params;

  if (!openingHoursRaw) return true;

  const oh = openingHoursRaw.toLowerCase();

  // 24/7 immer offen
  if (oh.includes("24/7") || oh.includes("24:00")) return true;

  // Morning-Logik
  if (preferredDaytimes.includes("morning")) {
    // wenn erst spät geöffnet → schlecht
    if (oh.includes("10:00") || oh.includes("11:00")) return false;
  }

  // Night-Logik
  if (preferredDaytimes.includes("night")) {
    // keine späten Zeiten → eher ungeeignet
    if (!oh.includes("22:") && !oh.includes("23:") && !oh.includes("00:")) {
      return false;
    }
  }

  return true;
}