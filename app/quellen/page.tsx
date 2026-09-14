import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

// Zentrale Lizenz- und Quellenseite: ODbL verlangt eine zumutbar auffindbare
// Namensnennung für OpenStreetMap-Daten — diese Seite ist der eine Ort dafür,
// verlinkt aus Footer und Rechtstext-Leiste.

export const metadata: Metadata = {
  title: "Quellen & Lizenzen | PerfectDay24",
  description:
    "Datenquellen und Lizenzen von PerfectDay24: OpenStreetMap, Wikimedia Commons, Ticketmaster und offizielle Stadtquellen.",
};

const linkClass =
  "underline underline-offset-2 transition hover:text-[var(--text-strong)]";

export default function QuellenPage() {
  return (
    <LegalPageShell
      title="Quellen & Lizenzen"
      updatedAt="13. September 2026"
      intro="PerfectDay24 baut auf offenen Daten auf. Diese Seite zeigt, woher Orts-, Bild-, Event- und Kartendaten stammen und unter welchen Lizenzen sie stehen."
      badge={null}
    >
      <LegalSection title="Ortsdaten">
        <p>
          Orts-, Adress- und Öffnungszeitendaten stammen aus OpenStreetMap:{" "}
          <strong>© OpenStreetMap-Mitwirkende</strong>, lizenziert unter der{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/"
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            Open Database License (ODbL 1.0)
          </a>
          . Details zur Namensnennung erklärt die{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            Urheberrechtsseite von OpenStreetMap
          </a>
          .
        </p>
        <p>
          Fällt dir ein Fehler auf — etwa eine veraltete Öffnungszeit oder eine
          falsche Adresse — freut sich das OpenStreetMap-Projekt über
          Korrekturen direkt an der Quelle; davon profitieren alle, die diese
          Daten nutzen.
        </p>
      </LegalSection>

      <LegalSection title="Fotos">
        <p>
          Viele Orts- und Routenfotos stammen aus{" "}
          <a
            href="https://commons.wikimedia.org/"
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            Wikimedia Commons
          </a>{" "}
          und stehen unter Creative-Commons-Lizenzen mit Namensnennung (z. B.
          CC BY oder CC BY-SA). Urheber, Lizenz und Quelle nennen wir jeweils
          direkt am Bild; der Nachweis verlinkt auf die Originalseite und den
          Lizenztext.
        </p>
        <p>
          Eigene Aufnahmen und von Partnern bereitgestellte Bilder tragen
          keinen Fremdnachweis.
        </p>
      </LegalSection>

      <LegalSection title="Eventdaten">
        <p>
          Veranstaltungsdaten beziehen wir unter anderem über die{" "}
          <a
            href="https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/"
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            Ticketmaster Discovery API
          </a>{" "}
          sowie aus offiziellen Stadtquellen wie städtischen
          Veranstaltungskalendern. Für Inhalte, Termine und Verfügbarkeiten
          gelten die Angaben des jeweiligen Veranstalters.
        </p>
      </LegalSection>

      <LegalSection title="Karten">
        <p>
          Die Kartenkacheln in unseren Karten stammen von OpenStreetMap; die
          Attribution wird direkt in den Karten eingeblendet
          (© OpenStreetMap). Für die zugrunde liegenden Kartendaten gilt
          ebenfalls die ODbL 1.0 (siehe Ortsdaten).
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
