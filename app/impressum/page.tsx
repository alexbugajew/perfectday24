import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Impressum | PerfectDay24",
  description: "Impressum fuer PerfectDay24 als detaillierte Platzhalterfassung zum Launch.",
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
      intro="Diese Seite ist als ausfuehrliche Platzhalterfassung fuer den oeffentlichen Launch gedacht. Sie ist bewusst etwas detaillierter aufgebaut, damit ihr nicht nur die Mindestangaben unterbringt, sondern auch die typischen Zusatzthemen wie Register, USt-IdNr., Verbraucherstreitbeilegung und redaktionelle Verantwortlichkeit strukturiert vorbereiten koennt."
    >
      <LegalSection title="Vor Veroeffentlichung zwingend pruefen">
        <BulletList
          items={[
            "Rechtlichen Unternehmensnamen und richtige Rechtsform eintragen.",
            "Vollstaendige ladungsfaehige Anschrift verwenden.",
            "Vertretungsberechtigte Person oder Personen korrekt nennen.",
            "Aktive Kontakt-E-Mail eintragen; optional Telefonnummer oder weiterer unmittelbarer Kontaktkanal.",
            "Registergericht und Registernummer ergaenzen, sobald die Eintragung vorliegt.",
            "USt-IdNr. oder W-IdNr. nur eintragen, wenn bereits vergeben.",
            "Pruefen, ob zusaetzliche Angaben zu Aufsichtsbehoerden, berufsrechtlichen Regelungen oder journalistisch-redaktioneller Verantwortung erforderlich sind.",
            "VSBG-Status zur Verbraucherstreitbeilegung klar festlegen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Hinweis zur Nutzung dieser Platzhalterseite">
        <p>
          Diese Seite ist auf einen typischen fruehen Launch von <strong>PerfectDay24</strong> als
          digitale Plattform vorbereitet. Nicht jeder Abschnitt ist zwingend in jedem Stadium noetig.
          Die optionalen Bloecke sollten aber bewusst entschieden und nicht einfach leer online
          gelassen werden.
        </p>
      </LegalSection>

      <LegalSection title="1. Angaben gemaess § 5 DDG">
        <p>
          Anbieter dieser Website und Web-App ist:
        </p>
        <AddressBlock
          lines={[
            <strong key="company-name">[Rechtlicher Unternehmensname]</strong>,
            "[Rechtsform]",
            "[Strasse und Hausnummer]",
            "[PLZ Ort]",
            "[Land]",
          ]}
        />
        <p>
          Falls Unternehmensname und Rechtsform in einer Zeile gefuehrt werden sollen, koennt ihr den
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
            "[Geschaeftsfuehrer/in]",
          ]}
        />
        <p>
          Falls mehrere vertretungsberechtigte Personen vorhanden sind:
        </p>
        <AddressBlock
          lines={[
            <strong key="representative-one">[Vorname Nachname]</strong>,
            <strong key="representative-two">[Vorname Nachname]</strong>,
            "[jeweilige Funktion / gemeinschaftliche oder einzelvertretungsberechtigte Vertretung nur falls gewuenscht]",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Kontakt">
        <p>Kontaktaufnahme ueber:</p>
        <AddressBlock
          lines={[
            "E-Mail: [kontakt@deinedomain.de]",
            "Telefon: [optional: +49 ...]",
          ]}
        />
        <p>
          Fuer eine schnelle elektronische Kontaktaufnahme und unmittelbare Kommunikation sollte hier
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
          oeffnen oder den Abschnitt bis zur Eintragung bewusst anders loesen.
        </p>
      </LegalSection>

      <LegalSection title="5. Umsatzsteuer und Wirtschafts-Identifikation">
        <AddressBlock
          lines={[
            "Umsatzsteuer-Identifikationsnummer gemaess § 27a UStG: [falls vorhanden]",
            "Wirtschafts-Identifikationsnummer gemaess § 139c AO: [falls vorhanden]",
          ]}
        />
        <p>
          Diese Angaben sollten nur gemacht werden, wenn die jeweilige Nummer bereits tatsaechlich
          vergeben wurde.
        </p>
      </LegalSection>

      <LegalSection title="6. Verantwortlich fuer Inhalte">
        <p>
          Verantwortlich fuer die Inhalte dieser Website:
        </p>
        <AddressBlock
          lines={[
            <strong key="content-owner">[Vorname Nachname]</strong>,
            "[Anschrift oder: Anschrift wie oben]",
          ]}
        />
        <p>
          Dieser Block ist als konservativer Platzhalter gedacht. Wenn ihr keine journalistisch-
          redaktionellen Inhalte im engeren Sinn veroeffentlicht, sollte vor dem finalen Launch noch
          einmal geprueft werden, ob ihr diesen Hinweis in genau dieser Form braucht.
        </p>
      </LegalSection>

      <LegalSection title="7. Aufsichtsbehoerde oder berufsrechtliche Angaben, falls einschlaegig">
        <p>
          Nur ausfuellen, wenn fuer euer konkretes Angebot eine gesetzliche Aufsicht oder besondere
          berufsrechtliche Pflichtangaben bestehen.
        </p>
        <AddressBlock
          lines={[
            "Zustaendige Aufsichtsbehoerde: [falls einschlaegig]",
            "Berufsbezeichnung und Staat der Verleihung: [falls einschlaegig]",
            "Berufsrechtliche Regelungen: [falls einschlaegig]",
            "Fundstelle der Regelungen: [falls einschlaegig]",
          ]}
        />
        <p>
          Fuer das aktuell sichtbare Plattformmodell von PerfectDay24 ist dieser Abschnitt
          voraussichtlich nur ein Sicherheitsplatzhalter.
        </p>
      </LegalSection>

      <LegalSection title="8. Verbraucherstreitbeilegung">
        <p>
          Wir sind <strong>[nicht bereit / bereit / verpflichtet]</strong>, an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
        <p>
          Falls ihr zur Teilnahme verpflichtet seid oder euch freiwillig verpflichtet, muessen hier
          zusaetzlich Anschrift und Website der zustaendigen Verbraucherschlichtungsstelle genannt
          werden.
        </p>
      </LegalSection>

      <LegalSection title="9. Vor Livegang final ersetzen">
        <BulletList
          items={[
            "Unternehmensname und Rechtsform",
            "vollstaendige ladungsfaehige Anschrift",
            "Geschaeftsfuehrer und Vertretungsregelung",
            "aktive Kontakt-E-Mail",
            "Registergericht und HRB-Nummer",
            "USt-IdNr. / W-IdNr., falls vorhanden",
            "VSBG-Status zur Schlichtung",
            "gegebenenfalls Verantwortlichkeit fuer redaktionelle Inhalte",
            "gegebenenfalls Aufsichts- oder Berufsangaben",
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
