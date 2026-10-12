/**
 * Entscheidet, ob eine Bild-URL von der Next.js-Bildoptimierung (/_next/image)
 * verarbeitet werden darf.
 *
 * Hintergrund: Der Optimizer liefert nur Hosts aus, die in next.config.ts unter
 * `images.remotePatterns` freigegeben sind — alles andere beantwortet er mit
 * einem 400 und das Bild bliebe leer. Rohe <img>-Tags hatten dieses Problem
 * nicht, weil sie beliebige Hosts direkt laden. Damit die Umstellung auf
 * <Image> fuer fremde Hosts nicht zu kaputten Bildern fuehrt, setzen wir dort
 * `unoptimized` — dann laedt <Image> die Original-URL unveraendert, genau wie
 * das alte <img>. Fuer freigegebene Hosts (und lokale /public-Pfade) greift die
 * Optimierung voll.
 *
 * Die Liste ist bewusst eine Teilmenge von remotePatterns: steht ein Host hier,
 * MUSS er auch in next.config.ts erlaubt sein, sonst brechen die Bilder.
 */
const NEXT_IMAGE_SAFE_HOSTS = new Set([
  "nxrkhlokadhwwtuoglxa.supabase.co",
  "images.unsplash.com",
  "plus.unsplash.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "lh3.googleusercontent.com",
  "graph.microsoft.com",
  "res.cloudinary.com",
  "i.imgur.com",
  "cdn.pixabay.com",
  "images.pexels.com",
  // Stop-Fotos aus dem OSM-/Editorial-Bestand kommen haeufig von Flickr; der
  // Host ist in next.config.ts freigegeben, fehlte aber bislang in dieser Liste.
  "live.staticflickr.com",
]);

export function canOptimizeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Relative Pfade zeigen auf eigene /public-Assets — die kann der Optimizer
  // immer verarbeiten, ein Host-Check wuerde hier nur unnoetig blockieren.
  if (url.startsWith("/")) return true;
  try {
    return NEXT_IMAGE_SAFE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
