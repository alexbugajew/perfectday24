// Client-seitiges Verkleinern vor dem Upload.
// ============================================================================
// Handy-Originale sind oft mehrere MB groß und wurden im Community-Upload bisher
// roh gespeichert -> langsames Laden auf der Seite und unnötig voller Storage.
// Dieser Helper skaliert ein Bild im Browser per Canvas auf eine maximale
// Kantenlänge herunter und komprimiert es, bevor es hochgeladen wird.
//
// Datenschutz: Das Re-Encode über Canvas schreibt eine frische Datei ohne
// EXIF-Block, Kamera-Metadaten samt GPS-Position fallen also weg. Weil der
// Bucket öffentlich lesbar ist, gibt der Helper deshalb NIE das Original zurück
// — auch nicht, wenn es kleiner wäre oder sich nicht dekodieren lässt (z. B.
// HEIC mit falscher Endung). Dann wirft er einen Fehler mit deutscher Meldung,
// statt die Datei samt Standort unverändert durchzureichen.
//
// EXIF-Orientierung wird über createImageBitmap(imageOrientation: "from-image")
// in die Pixel übernommen: Das Orientation-Tag geht beim Re-Encode mit verloren,
// ohne diesen Schritt landeten Hochformat-Fotos gekippt.
//
// Der Admin-Foto-Upload bringt eine eigene, ältere Variante mit; dieser Helper
// ist die geteilte Fassung für künftige Upload-Pfade.

export type DownscaleOptions = {
  // Längste Kante nach dem Skalieren (px). Reicht für Cover-/Stop-Fotos.
  maxEdge?: number;
  // JPEG/WebP-Qualität 0..1.
  quality?: number;
  // Ziel-Format. JPEG ist breit kompatibel; WebP wäre kleiner.
  mimeType?: "image/jpeg" | "image/webp";
  // Obergrenze für die fertige Datei in Bytes (z. B. file_size_limit des
  // Buckets), damit der Upload nicht erst am Storage scheitert.
  maxBytes?: number;
};

// Fehler mit nutzerlesbarer Meldung — der Aufrufer zeigt `message` direkt an.
export class ImageDownscaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageDownscaleError";
  }
}

// Safari < 17 liefert bei nicht unterstütztem Ziel-Format stillschweigend PNG;
// die Endung folgt deshalb dem tatsächlich erzeugten Typ, nicht dem gewünschten.
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
};

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

export async function downscaleImageFile(
  file: File,
  { maxEdge = 2000, quality = 0.82, mimeType = "image/jpeg", maxBytes }: DownscaleOptions = {}
): Promise<File> {
  const label = file.name || "Foto";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageDownscaleError(
      `Bild lässt sich nicht öffnen: ${label}. Bitte ein JPEG-, PNG- oder WebP-Foto wählen – HEIC-Fotos vorher in JPEG umwandeln.`
    );
  }

  let blob: Blob | null;
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ImageDownscaleError(
        `Bild kann in diesem Browser nicht verkleinert werden: ${label}. Bitte einen aktuellen Browser verwenden.`
      );
    }
    // Weißer Grund statt Schwarz für transparente PNG/WebP-Flächen (JPEG kennt
    // keine Transparenz).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    // Die Standard-Glättung ("low", bilinear) erzeugt bei großen Sprüngen
    // (6000 -> 2000 px) Aliasing/Moiré; "high" filtert sauberer und macht die
    // Datei im Test sogar kleiner, weil weniger Rauschen zu kodieren ist.
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mimeType, quality));
  } finally {
    bitmap.close();
  }

  if (!blob) {
    throw new ImageDownscaleError(`Bild konnte nicht verkleinert werden: ${label}. Bitte ein anderes Foto versuchen.`);
  }
  if (maxBytes !== undefined && blob.size > maxBytes) {
    throw new ImageDownscaleError(
      `Datei ist auch verkleinert noch zu groß: ${label} (max. ${formatMegabytes(maxBytes)}).`
    );
  }

  const type = blob.type || mimeType;
  const ext = EXTENSION_BY_TYPE[type] ?? "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${baseName}.${ext}`, { type });
}
