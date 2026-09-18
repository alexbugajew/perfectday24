import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegalPageShell, { LegalSection, Offen } from "@/components/legal/LegalPageShell";
import {
  ANBIETER,
  DATENSCHUTZ_AUFSICHT,
  FIRMA_ANZEIGE,
  IN_GRUENDUNG,
  istOffen,
  VSBG_BEREIT,
} from "@/lib/legal/anbieter";

export const metadata: Metadata = {
  title: "Impressum | PerfectDay24",
  description: "Anbieterkennzeichnung und Pflichtangaben nach § 5 DDG für PerfectDay24.",
};

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

/** Gibt den Wert aus — oder die sichtbare Luecke, wenn er noch fehlt. */
function Wert({ wert, was }: { wert: string; was: string }) {
  return istOffen(wert) ? <Offen was={was} /> : <>{wert}</>;
}

export default function ImpressumPage() {
  return (
    <LegalPageShell
      title="Impressum"
      updatedAt="26. August 2026"
      intro="Anbieterkennzeichnung und gesetzliche Pflichtangaben für PerfectDay24 gemäß § 5 DDG."
    >
      <LegalSection title="1. Angaben gemäß § 5 DDG">
        <p>Anbieter dieser Website und Web-App ist:</p>
        <AddressBlock
          lines={[
            <strong key="firma">{FIRMA_ANZEIGE}</strong>,
            ANBIETER.strasse,
            ANBIETER.plzOrt,
            ANBIETER.land,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Vertreten durch">
        <AddressBlock
          lines={[
            <strong key="vertretung">
              <Wert wert={ANBIETER.vertretenDurch} was="Name der Geschäftsführung" />
            </strong>,
            "Geschäftsführer",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Kontakt">
        <AddressBlock
          lines={[
            <span key="mail">
              E-Mail: <Wert wert={ANBIETER.email} was="Kontakt-E-Mail" />
            </span>,
          ]}
        />
        <p>
          Anfragen zu dieser Website, zu Verträgen und zum Datenschutz erreichen uns über diese
          Adresse. Wir antworten in der Regel innerhalb weniger Werktage.
        </p>
      </LegalSection>

      <LegalSection title="4. Registereintrag">
        {IN_GRUENDUNG ? (
          <>
            <p>
              Die Gesellschaft befindet sich in Gründung. Die Eintragung in das Handelsregister
              beim {ANBIETER.registergericht} ist beantragt und liegt noch nicht vor; eine
              Registernummer besteht deshalb noch nicht. Bis zur Eintragung führen wir die Firma
              mit dem Zusatz {"„i. G.“"}.
            </p>
            <p>
              Diese Angabe wird ersetzt, sobald die Eintragung erfolgt ist.
            </p>
          </>
        ) : (
          <AddressBlock
            lines={[
              `Registergericht: ${ANBIETER.registergericht}`,
              <span key="hrb">
                Registernummer: <Wert wert={ANBIETER.registernummer} was="HRB-Nummer" />
              </span>,
            ]}
          />
        )}
      </LegalSection>

      <LegalSection title="5. Umsatzsteuer-Identifikationsnummer">
        <AddressBlock
          lines={[
            <span key="ust">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:{" "}
              <Wert wert={ANBIETER.ustIdNr} was="USt-IdNr., falls vergeben" />
            </span>,
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Verantwortlich für den Inhalt">
        <AddressBlock
          lines={[
            <strong key="verantwortlich">
              <Wert wert={ANBIETER.vertretenDurch} was="Name der Geschäftsführung" />
            </strong>,
            "Anschrift wie oben",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Aufsichtsbehörde für den Datenschutz">
        <p>
          Für die Verarbeitung personenbezogener Daten durch uns ist zuständig:
        </p>
        <AddressBlock
          lines={[
            DATENSCHUTZ_AUFSICHT.name,
            DATENSCHUTZ_AUFSICHT.strasse,
            DATENSCHUTZ_AUFSICHT.plzOrt,
            `Telefon: ${DATENSCHUTZ_AUFSICHT.telefon}`,
            `E-Mail: ${DATENSCHUTZ_AUFSICHT.email}`,
          ]}
        />
        <p>
          Wie wir mit deinen Daten umgehen, steht in der{" "}
          <a href="/datenschutz" className="underline underline-offset-2">
            Datenschutzerklärung
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Verbraucherstreitbeilegung">
        <p>
          Wir sind <strong>{VSBG_BEREIT ? "bereit" : "nicht bereit und nicht verpflichtet"}</strong>,
          an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
