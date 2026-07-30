import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "AGB | PerfectDay24",
  description: "Allgemeine Geschäftsbedingungen für PerfectDay24.",
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

function OrderedList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-3 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}

export default function AgbPage() {
  return (
    <LegalPageShell
      title="Allgemeine Geschäftsbedingungen"
      updatedAt="21. April 2026"
      intro="Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der Website, Web-App und sonstigen digitalen Dienste von PerfectDay24."
    >
      <LegalSection title="Arbeitsannahmen für diesen Entwurf">
        <p>Dieser Entwurf ist auf den derzeit erkennbaren Produktstand von PerfectDay24 zugeschnitten:</p>
        <BulletList
          items={[
            "digitale Plattform für personalisierte Tagesplanung, Routen, Event- und Location-Empfehlungen",
            "Nutzerkonten, Gastzugang, Gruppenplanung, Sharing und Creator-/Route-Funktionen",
            "externe Ticket-, Reservierungs- oder Buchungslinks zu Drittanbietern",
            "mögliche Affiliate-Links und klar gekennzeichnete Sponsored-/Partner-Platzierungen",
            "derzeit kein erkennbarer eigener Verkauf von Tickets, Reservierungen oder Vor-Ort-Leistungen durch PerfectDay24",
            "Kernnutzung für Endnutzer aktuell grundsätzlich unentgeltlich; spätere Premium- oder Partnerprodukte sind möglich",
          ]}
        />
      </LegalSection>

      <LegalSection title="Vor Veröffentlichung zwingend ausfüllen">
        <BulletList
          items={[
            "Firma: [Rechtlicher Unternehmensname / Rechtsform]",
            "Anschrift: [Straße, Hausnummer, PLZ, Ort, Land]",
            "Vertretungsberechtigte Person: [Geschäftsführer/in]",
            "E-Mail: [E-Mail-Adresse]",
            "Telefon: [optional]",
            "Handelsregister: [Amtsgericht / HRB, sobald vorhanden]",
            "USt-IdNr.: [falls vorhanden]",
            "Sitz / Gerichtsstand für Unternehmer: [Ort]",
          ]}
        />
      </LegalSection>

      <LegalSection title="Wichtige Hinweise vor Go-Live">
        <BulletList
          items={[
            "Falls ihr später kostenpflichtige Abos, Premium-Funktionen oder Partnerpakete live schaltet, sollten diese AGB vor Freischaltung erweitert werden.",
            "Für entgeltliche B2C-Leistungen braucht ihr zusätzlich eine saubere Widerrufsbelehrung und einen rechtssicheren Checkout.",
            "Datenschutz, Impressum und Cookie-/Tracking-Setup müssen separat rechtlich abgestimmt werden.",
            "Wegen Nutzerkonto, Profilen und personalisierten digitalen Leistungen sollte der finale Text vor Veröffentlichung anwaltlich geprüft werden.",
          ]}
        />
      </LegalSection>

      <LegalSection title="1. Geltungsbereich">
        <OrderedList
          items={[
            <>
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der von
              <strong> [Rechtlicher Unternehmensname / Rechtsform]</strong>, <strong>[Anschrift]</strong>,
              vertreten durch <strong>[Geschäftsführer/in]</strong> (nachfolgend
              <strong> &quot;PerfectDay24&quot;</strong> oder <strong>&quot;wir&quot;</strong>),
              angebotenen Website, Web-App und sonstigen digitalen Dienste unter der Marke
              PerfectDay24.
            </>,
            "Die AGB gelten für unentgeltliche und, soweit gesondert angeboten, für entgeltliche digitale Leistungen von PerfectDay24.",
            "Die AGB gelten gegenüber Verbrauchern im Sinne des Paragrafen 13 BGB sowie gegenüber Unternehmern im Sinne des Paragrafen 14 BGB, soweit nicht in einzelnen Bestimmungen ausdrücklich differenziert wird.",
            "Abweichende Bedingungen des Nutzers gelten nur, wenn wir ihrer Geltung ausdrücklich in Textform zugestimmt haben.",
            "Für Verträge über Leistungen Dritter, insbesondere Tickets, Reservierungen, Buchungen, Gastronomie-, Event-, Freizeit- oder touristische Angebote, gelten ausschließlich die Bedingungen des jeweiligen Drittanbieters.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Leistungen von PerfectDay24">
        <OrderedList
          items={[
            "PerfectDay24 bietet eine digitale Plattform für personalisierte Tagesplanung, Routen- und Ablaufvorschläge, Event- und Location-Empfehlungen, Creator-Routen, Gruppenabstimmung, Sharing-Funktionen sowie damit zusammenhängende digitale Dienste.",
            "Die Inhalte und Vorschläge können auf Nutzereingaben, Profilangaben, Interessen, Standortdaten, KI-gestützter Verarbeitung, eigenen kuratorischen Entscheidungen sowie Daten von Drittquellen beruhen.",
            "Unsere Leistungen dienen der Information, Inspiration und digitalen Planungshilfe. Sie stellen keine Garantie für Verfügbarkeit, Eignung, Aktualität oder Durchführbarkeit eines Vorschlags dar und keine individuelle rechtliche, medizinische, steuerliche oder sonstige Fachberatung.",
            "Angaben zu Öffnungszeiten, Preisen, Verfügbarkeiten, Einlassbedingungen, Altersfreigaben, Barrierefreiheit, Wetter, Verkehrszeiten, Auslastung oder kurzfristigen Änderungen können sich jederzeit ändern. Nutzer sind verpflichtet, für sie wesentliche Informationen vor Inanspruchnahme eines Angebots selbst zu überprüfen.",
            "Soweit Kernfunktionen von PerfectDay24 unentgeltlich angeboten werden, besteht kein Anspruch auf die jederzeitige Beibehaltung eines bestimmten Funktionsumfangs. Gesetzliche Rechte von Verbrauchern bei digitalen Produkten bleiben unberührt.",
            "Wir sind berechtigt, Leistungen technisch, inhaltlich und gestalterisch weiterzuentwickeln, einzuschränken oder zu ändern, soweit hierdurch kein Verstoß gegen zwingendes Recht vorliegt und berechtigte Interessen der Nutzer angemessen berücksichtigt werden.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Registrierung, Nutzerkonto und Gastnutzung">
        <OrderedList
          items={[
            "Die Nutzung bestimmter Funktionen kann eine Registrierung und die Einrichtung eines Nutzerkontos erfordern. Andere Funktionen können gegebenenfalls auch ohne Registrierung als Gast genutzt werden.",
            "Bei der Registrierung sind sämtliche Angaben wahrheitsgemäß, aktuell und vollständig zu machen. Änderungen wesentlicher Daten sind vom Nutzer unverzüglich zu aktualisieren.",
            "Die Registrierung ist nur voll geschäftsfähigen Personen erlaubt. Minderjährige dürfen registrierungspflichtige Funktionen nur mit Zustimmung ihrer gesetzlichen Vertreter nutzen.",
            "Zugangsdaten sind vertraulich zu behandeln und vor dem Zugriff Dritter zu schützen. Der Nutzer ist für alle Aktivitäten verantwortlich, die über sein Konto veranlasst werden, sofern er den Missbrauch zu vertreten hat.",
            "Das Nutzerkonto ist nicht übertragbar.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Vertragsschluss und Umfang der Nutzung">
        <OrderedList
          items={[
            "Der Nutzungsvertrag über unentgeltliche Leistungen kommt mit Abschluss der Registrierung oder, soweit keine Registrierung erforderlich ist, mit Beginn der Nutzung der Plattform zustande.",
            "Soweit PerfectDay24 entgeltliche Leistungen anbietet, werden Leistungsumfang, Preis, Laufzeit, etwaige Kündigungsfristen und Zahlungsbedingungen vor Vertragsschluss gesondert angezeigt.",
            "Soweit Verbrauchern für entgeltliche Leistungen ein gesetzliches Widerrufsrecht zusteht, wird hierüber gesondert belehrt.",
            "Der Nutzer erhält für die Dauer des Vertrags ein einfaches, nicht ausschließliches, nicht übertragbares Recht, PerfectDay24 im vertraglich vorgesehenen Umfang für eigene rechtmäßige Zwecke zu nutzen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Zulässige Nutzung und verbotene Handlungen">
        <OrderedList
          items={[
            "Die Nutzung von PerfectDay24 ist nur im Rahmen der geltenden Gesetze und dieser AGB zulässig.",
            <>
              Dem Nutzer ist insbesondere untersagt:
              <div className="mt-3">
                <BulletList
                  items={[
                    "technische Schutzmaßnahmen zu umgehen,",
                    "automatisierte Massenzugriffe, Scraping, Crawling oder Data-Mining ohne unsere vorherige Zustimmung vorzunehmen,",
                    "Schadcode, Bots oder sonstige störende Software einzusetzen,",
                    "Inhalte rechtswidrig, irreführend, beleidigend, diskriminierend, gewaltverherrlichend oder sonst rechtsverletzend einzustellen,",
                    "die Plattform missbräuchlich für Spam, unerlaubte Werbung oder systematische Störungen zu verwenden,",
                    "Inhalte oder Funktionen von PerfectDay24 ohne Erlaubnis kommerziell weiterzuverwerten, weiterzuverkaufen oder Dritten als eigenes Angebot bereitzustellen.",
                  ]}
                />
              </div>
            </>,
            "Wir sind berechtigt, bei konkreten Anhaltspunkten für eine rechtswidrige oder vertragswidrige Nutzung angemessene Maßnahmen zu treffen, insbesondere Inhalte zu entfernen, Funktionen einzuschränken oder Nutzerkonten vorläufig oder dauerhaft zu sperren.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Nutzerinhalte und Creator-Inhalte">
        <OrderedList
          items={[
            <>
              Soweit Nutzer Inhalte einstellen, hochladen, speichern, verknüpfen oder
              veröffentlichen, insbesondere Profilangaben, Routentitel, Beschreibungen, Bilder,
              Empfehlungen, Kommentare oder sonstige Inhalte (nachfolgend zusammen
              <strong> &quot;Nutzerinhalte&quot;</strong>), verbleiben die Rechte hieran grundsätzlich
              beim Nutzer.
            </>,
            "Der Nutzer räumt PerfectDay24 an den Nutzerinhalten ein einfaches, unentgeltliches und räumlich unbeschränktes Nutzungsrecht ein, soweit dies für den Betrieb der Plattform, die technische Verarbeitung, die Speicherung, die Veröffentlichung innerhalb der Plattform, die Darstellung gegenüber anderen Nutzern, die Fehleranalyse, die Sicherung sowie die Bewerbung der Plattform und der jeweiligen Inhalte erforderlich ist. Das Nutzungsrecht besteht für die Dauer der Bereitstellung des jeweiligen Nutzerinhalts und danach nur insoweit fort, wie dies für Sicherungskopien, gesetzliche Aufbewahrungspflichten oder bereits veranlasste Plattformdarstellungen erforderlich ist.",
            "Der Nutzer sichert zu, dass er über die für die Nutzung und Veröffentlichung der Nutzerinhalte erforderlichen Rechte verfügt und durch die Inhalte keine Rechte Dritter oder gesetzliche Vorschriften verletzt werden.",
            "Wir sind nicht verpflichtet, Nutzerinhalte inhaltlich vorab zu prüfen. Wir sind jedoch berechtigt, Nutzerinhalte bei Verdacht auf Rechtsverletzungen, Verstoß gegen diese AGB oder sonstigen berechtigten Gründen zu sperren, zu entfernen oder ihre Sichtbarkeit einzuschränken.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Verfügbarkeit, technische Störungen und Änderungen">
        <OrderedList
          items={[
            "PerfectDay24 bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform. Ein Anspruch auf unterbrechungsfreie oder jederzeit fehlerfreie Verfügbarkeit besteht jedoch nicht.",
            "Insbesondere Wartungsarbeiten, Sicherheitsupdates, Kapazitätsengpässe, technische Störungen, Störungen bei Drittanbietern oder höhere Gewalt können zu vorübergehenden Einschränkungen oder Ausfällen führen.",
            "Soweit wir dauerhaft digitale Leistungen gegen Entgelt oder im rechtlich einschlägigen Rahmen gegen Bereitstellung personenbezogener Daten bereitstellen, erfolgen Änderungen dieser Leistungen nur im Rahmen der gesetzlichen Vorschriften.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Externe Angebote, Buchungen, Tickets und Reservierungen">
        <OrderedList
          items={[
            "PerfectDay24 kann auf externe Angebote Dritter verlinken oder entsprechende Deep Links, Ticket-Links, Reservierungslinks oder sonstige Weiterleitungen bereitstellen.",
            "Soweit nicht im Einzelfall ausdrücklich anders gekennzeichnet, wird PerfectDay24 dadurch nicht selbst Vertragspartner des über den Drittanbieter geschlossenen Geschäfts. Verträge über Tickets, Reservierungen, Gastronomie-, Event-, Freizeit-, Reise- oder sonstige Drittleistungen kommen ausschließlich zwischen dem Nutzer und dem jeweiligen Drittanbieter zustande.",
            "PerfectDay24 übernimmt keine Verantwortung für Inhalt, Richtigkeit, Rechtmäßigkeit, Verfügbarkeit, Preisgestaltung, Vertragserfüllung, Zahlung, Stornierung, Rückabwicklung oder Mängel von Leistungen Dritter.",
            "Für die Nutzung und Buchung von Drittleistungen gelten ausschließlich die Vertragsbedingungen, Datenschutzinformationen und sonstigen Regelungen des jeweiligen Drittanbieters.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Affiliate-Links, Werbung und gesponserte Platzierungen">
        <OrderedList
          items={[
            "PerfectDay24 kann Affiliate-Links, Partnerlinks, gesponserte Inhalte, Featured-Platzierungen oder sonstige kommerzielle Kommunikationen enthalten.",
            "Sofern PerfectDay24 für Klicks, Leads, Buchungen oder Abschlüsse eine Vergütung oder Provision erhält, erfolgt dies im Rahmen der jeweiligen Partnerbeziehung. Entsprechende kommerzielle Inhalte oder Platzierungen werden nach den gesetzlichen Vorgaben als solche kenntlich gemacht.",
            "Die Existenz einer Partnerbeziehung bedeutet nicht automatisch, dass PerfectDay24 für die Leistungserbringung des Drittanbieters verantwortlich wird.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Entgelte und Zahlung bei kostenpflichtigen Leistungen">
        <OrderedList
          items={[
            "Soweit PerfectDay24 kostenpflichtige Leistungen anbietet, gelten die bei Vertragsschluss angezeigten Preise.",
            "Sofern nicht anders angegeben, verstehen sich Preise gegenüber Verbrauchern einschließlich der gesetzlichen Umsatzsteuer.",
            "Zahlungen sind, soweit nicht anders vereinbart, unmittelbar mit Vertragsschluss fällig.",
            "Bei Zahlungsverzug sind wir berechtigt, den Zugang zu entgeltlichen Leistungen nach vorheriger Mahnung und angemessener Fristsetzung ganz oder teilweise zu sperren, soweit dem keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Laufzeit und Kündigung">
        <OrderedList
          items={[
            "Der Vertrag über die unentgeltliche Nutzung von PerfectDay24 wird auf unbestimmte Zeit geschlossen und kann vom Nutzer jederzeit ohne Einhaltung einer Frist gekündigt werden, etwa durch Löschung des Kontos oder entsprechende Mitteilung in Textform.",
            "Wir können den Vertrag über unentgeltliche Leistungen mit angemessener Frist ordentlich kündigen, soweit dem keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
            "Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.",
            <>
              Ein wichtiger Grund für eine Sperrung oder außerordentliche Kündigung durch
              PerfectDay24 liegt insbesondere vor, wenn der Nutzer:
              <div className="mt-3">
                <BulletList
                  items={[
                    "bei der Registrierung falsche wesentliche Angaben macht,",
                    "gegen diese AGB oder geltendes Recht verstößt,",
                    "die Plattform missbräuchlich oder störend nutzt,",
                    "Rechte Dritter verletzt oder",
                    "im Falle entgeltlicher Leistungen trotz Mahnung fällige Zahlungen nicht leistet.",
                  ]}
                />
              </div>
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Haftung">
        <OrderedList
          items={[
            <>
              PerfectDay24 haftet unbeschränkt:
              <div className="mt-3">
                <BulletList
                  items={[
                    "bei Vorsatz und grober Fahrlässigkeit,",
                    "bei schuldhafter Verletzung des Lebens, des Körpers oder der Gesundheit,",
                    "nach den Vorschriften des Produkthaftungsgesetzes sowie",
                    "in allen sonstigen Fällen, in denen eine unbeschränkte Haftung gesetzlich zwingend vorgeschrieben ist.",
                  ]}
                />
              </div>
            </>,
            "Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht ist unsere Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Nutzer regelmäßig vertrauen darf.",
            "Im Übrigen ist die Haftung von PerfectDay24 für leicht fahrlässige Pflichtverletzungen ausgeschlossen.",
            "Die vorstehenden Haftungsbeschränkungen gelten entsprechend zugunsten unserer gesetzlichen Vertreter, Mitarbeitenden, Erfüllungsgehilfen und sonstigen Beauftragten.",
            "Soweit Informationen, Empfehlungen, Eventdaten, Öffnungszeiten, Routenhinweise oder sonstige Inhalte ganz oder teilweise von Dritten stammen oder auf automatisierten Verfahren beruhen, haftet PerfectDay24 für deren inhaltliche Richtigkeit nur nach Maßgabe der vorstehenden Absätze.",
            "Gesetzliche Rechte von Verbrauchern bei Mängeln entgeltlicher digitaler Produkte bleiben unberührt.",
          ]}
        />
      </LegalSection>

      <LegalSection title="13. Datenschutz">
        <p>
          Informationen zur Verarbeitung personenbezogener Daten finden sich in unserer
          Datenschutzerklärung.
        </p>
      </LegalSection>

      <LegalSection title="14. Verbraucherstreitbeilegung">
        <p>
          PerfectDay24 ist weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen, sofern nicht eine gesetzliche Verpflichtung
          besteht.
        </p>
      </LegalSection>

      <LegalSection title="15. Anwendbares Recht und Gerichtsstand">
        <OrderedList
          items={[
            "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts, soweit dem keine zwingenden gesetzlichen Verbraucherschutzvorschriften entgegenstehen.",
            <>
              Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder
              öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle
              Streitigkeiten aus oder im Zusammenhang mit diesem Vertragsverhältnis der Sitz von
              PerfectDay24, derzeit <strong>[Ort]</strong>.
            </>,
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
