import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Impressum | PerfectDay24",
  description: "Impressum für PerfectDay24.",
};

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function AddressBlock({ lines }: { lines: ReactNode[] }) {
  return (
    <p>
      {lines.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

export default function ImpressumPage() {
  return (
    <LegalPageShell
      title="Impressum"
      updatedAt="21. April 2026"
      intro="Anbieterkennzeichnung und gesetzliche Pflichtangaben für PerfectDay24 gemäß § 5 DDG."
    >
      <LegalSection title="Vor Veröffentlichung zwingend prüfen">
        <BulletList
          items={[
            "Rechtlichen Unternehmensnamen und richtige Rechtsform eintragen.",
            "Vollständige ladungsfähige Anschrift verwenden.",
            "Vertretungsberechtigte Person oder Personen korrekt nennen.",
            "Aktive Kontakt-E-Mail eintragen; optional Telefonnummer oder weiterer unmittelbarer Kontaktkanal.",
            "Registergericht und Registernummer ergänzen, sobald die Eintragung vorliegt.",
            "USt-IdNr. oder W-IdNr. nur eintragen, wenn bereits vergeben.",
            "Prüfen, ob zusätzliche Angaben zu Aufsichtsbehörden, berufsrechtlichen Regelungen oder journalistisch-redaktioneller Verantwortung erforderlich sind.",
            "VSBG-Status zur Verbraucherstreitbeilegung klar festlegen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Hinweis zur Nutzung dieser Platzhalterseite">
        <p>
          Diese Seite ist auf einen typischen frühen Launch von <strong>PerfectDay24</strong> als
          digitale Plattform vorbereitet. Nicht jeder Abschnitt ist zwingend in jedem Stadium nötig.
          Die optionalen Blöcke sollten aber bewusst entschieden und nicht einfach leer online
          gelassen werden.
        </p>
      </LegalSection>

      <LegalSection title="1. Angaben gemäß § 5 DDG">
        <p>
          Anbieter dieser Website und Web-App ist:
        </p>
        <AddressBlock
          lines={[
            <strong key="company-name">[Rechtlicher Unternehmensname]</strong>,
            "[Rechtsform]",
            "[Straße und Hausnummer]",
            "[PLZ Ort]",
            "[Land]",
          ]}
        />
        <p>
          Falls Unternehmensname und Rechtsform in einer Zeile geführt werden sollen, könnt ihr den
          ersten und zweiten Platzhalter auch zusammenziehen, zum Beispiel:
          <br />
          <strong>[PerfectDay24 GmbH]</strong>
        </p>
      </LegalSection>

      <LegalSection title="2. Vertreten durch">
        <p>
          Vertreten durch:
        </p>
        <AddressBlock
          lines={[
            <strong key="representative-name">[Vorname Nachname]</strong>,
            "[Geschäftsführer/in]",
          ]}
        />
        <p>
          Falls mehrere vertretungsberechtigte Personen vorhanden sind:
        </p>
        <AddressBlock
          lines={[
            <strong key="representative-one">[Vorname Nachname]</strong>,
            <strong key="representative-two">[Vorname Nachname]</strong>,
            "[jeweilige Funktion / gemeinschaftliche oder einzelvertretungsberechtigte Vertretung nur falls gewünscht]",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Kontakt">
        <p>Kontaktaufnahme über:</p>
        <AddressBlock
          lines={[
            "E-Mail: [kontakt@deinedomain.de]",
            "Telefon: [optional: +49 ...]",
          ]}
        />
        <p>
          Für eine schnelle elektronische Kontaktaufnahme und unmittelbare Kommunikation sollte hier
          mindestens eine aktive E-Mail-Adresse genannt sein.
        </p>
      </LegalSection>

      <LegalSection title="4. Registereintrag">
        <p>
          Eintragung im Handelsregister:
        </p>
        <AddressBlock
          lines={[
            "Registergericht: [Amtsgericht Ort]",
            "Registernummer: [HRB ...]",
          ]}
        />
        <p>
          Wenn die Gesellschaft noch nicht eingetragen ist, sollte diese Seite nicht mit offenem
          Register-Platzhalter produktiv bleiben. In diesem Fall entweder den Launch noch nicht
          öffnen oder den Abschnitt bis zur Eintragung bewusst anders lösen.
        </p>
      </LegalSection>

      <LegalSection title="5. Umsatzsteuer und Wirtschafts-Identifikation">
        <AddressBlock
          lines={[
            "Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: [falls vorhanden]",
            "Wirtschafts-Identifikationsnummer gemäß § 139c AO: [falls vorhanden]",
          ]}
        />
        <p>
          Diese Angaben sollten nur gemacht werden, wenn die jeweilige Nummer bereits tatsächlich
          vergeben wurde.
        </p>
      </LegalSection>

      <LegalSection title="6. Verantwortlich für Inhalte">
        <p>
          Verantwortlich für die Inhalte dieser Website:
        </p>
        <AddressBlock
          lines={[
            <strong key="content-owner">[Vorname Nachname]</strong>,
            "[Anschrift oder: Anschrift wie oben]",
          ]}
        />
        <p>
          Dieser Block ist als konservativer Platzhalter gedacht. Wenn ihr keine journalistisch-
          redaktionellen Inhalte im engeren Sinn veröffentlicht, sollte vor dem finalen Launch noch
          einmal geprüft werden, ob ihr diesen Hinweis in genau dieser Form braucht.
        </p>
      </LegalSection>

      <LegalSection title="7. Aufsichtsbehörde oder berufsrechtliche Angaben, falls einschlägig">
        <p>
          Nur ausfüllen, wenn für euer konkretes Angebot eine gesetzliche Aufsicht oder besondere
          berufsrechtliche Pflichtangaben bestehen.
        </p>
        <AddressBlock
          lines={[
            "Zuständige Aufsichtsbehörde: [falls einschlägig]",
            "Berufsbezeichnung und Staat der Verleihung: [falls einschlägig]",
            "Berufsrechtliche Regelungen: [falls einschlägig]",
            "Fundstelle der Regelungen: [falls einschlägig]",
          ]}
        />
        <p>
          Für das aktuell sichtbare Plattformmodell von PerfectDay24 ist dieser Abschnitt
          voraussichtlich nur ein Sicherheitsplatzhalter.
        </p>
      </LegalSection>

      <LegalSection title="8. Verbraucherstreitbeilegung">
        <p>
          Wir sind <strong>[nicht bereit / bereit / verpflichtet]</strong>, an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
        <p>
          Falls ihr zur Teilnahme verpflichtet seid oder euch freiwillig verpflichtet, müssen hier
          zusätzlich Anschrift und Website der zuständigen Verbraucherschlichtungsstelle genannt
          werden.
        </p>
      </LegalSection>

      <LegalSection title="9. Vor Livegang final ersetzen">
        <BulletList
          items={[
            "Unternehmensname und Rechtsform",
            "vollständige ladungsfähige Anschrift",
            "Geschäftsführer und Vertretungsregelung",
            "aktive Kontakt-E-Mail",
            "Registergericht und HRB-Nummer",
            "USt-IdNr. / W-IdNr., falls vorhanden",
            "VSBG-Status zur Schlichtung",
            "gegebenenfalls Verantwortlichkeit für redaktionelle Inhalte",
            "gegebenenfalls Aufsichts- oder Berufsangaben",
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
