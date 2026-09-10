import Link from "next/link";
import { getMonetizationAdminAccessState } from "@/lib/monetization/admin-server";
import FotoUploadClient from "./FotoUploadClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Admin-Foto-Upload: eigene Fotos batchweise hochladen, Zuordnung zur
// Location läuft über EXIF-GPS (Vorauswahl) plus einen Bestätigungsklick.
export default async function AdminFotosPage() {
  const access = await getMonetizationAdminAccessState();

  if (!access.allowed) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold">Kein Zugriff</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {access.reason === "unauthenticated"
            ? "Bitte zuerst anmelden."
            : "Dieser Bereich ist der Admin-Allowlist vorbehalten."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Zur Startseite
        </Link>
      </main>
    );
  }

  return <FotoUploadClient />;
}
