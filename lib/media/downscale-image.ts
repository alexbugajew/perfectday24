// Client-seitiges Verkleinern vor dem Upload.
// ============================================================================
// Handy- und OSM-Originale sind oft mehrere MB und wurden bisher teils roh
// gespeichert (Community-Upload) -> langsames Laden auf der Seite und unnoetig
// voller Storage. Dieser Helper skaliert ein Bild im Browser per Canvas auf eine
// maximale Kantenlaenge herunter und komprimiert es, bevor es hochgeladen wird.
// Der Admin-Foto-Upload bringt eine eigene, aeltere Variante mit; dieser Helper
// ist die geteilte Fassung fuer kuenftige Upload-Pfade.
//
// EXIF-Orientierung wird ueber createImageBitmap(imageOrientation: "from-image")
// angewandt, damit Hochformat-Fotos nicht gedreht landen.

export type DownscaleOptions = {
  // Laengste Kante nach dem Skalieren (px). Reicht fuer Cover-/Stop-Fotos.
  maxEdge?: number;
  // JPEG/WebP-Qualitaet 0..1.
  quality?: number;
  // Ziel-Format. JPEG ist breit kompatibel; WebP waere kleiner.
  mimeType?: "image/jpeg" | "image/webp";
};

export async function downscaleImageFile(
  file: File,
  { maxEdge = 2000, quality = 0.82, mimeType = "image/jpeg" }: DownscaleOptions = {}
): Promise<File> {
  // Nur Rasterbilder anfassen; alles andere unveraendert zurueckgeben.
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Format nicht dekodierbar (z.B. HEIC in manchen Browsern) -> Original behalten.
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  // Weisser Grund statt Schwarz fuer transparente PNG/WebP-Flaechen (JPEG kennt
  // keine Transparenz).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mimeType, quality)
  );
  // Kodierung fehlgeschlagen oder (bei schon kleinen Bildern) groesser als das
  // Original -> das kleinere von beiden nehmen.
  if (!blob || blob.size >= file.size) return file;

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${baseName}.${ext}`, { type: blob.type || mimeType });
}
