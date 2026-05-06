import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "AGB | PerfectDay24",
  description: "Allgemeine Geschaeftsbedingungen fuer PerfectDay24 auf Basis des Entwurfs vom 21.04.2026.",
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
      title="Allgemeine Geschaeftsbedingungen"
      updatedAt="21. April 2026"
      intro="Diese Seite basiert inhaltlich eng auf dem AGB-Entwurf vom 21.04.2026. Die juristische Substanz wurde uebernommen, die starre UG-Bezeichnung aber bewusst in neutrale Unternehmensplatzhalter umgestellt, damit die Fassung auch fuer eure geplante GmbH nutzbar bleibt."
    >
      <LegalSection title="Arbeitsannahmen fuer diesen Entwurf">
        <p>Dieser Entwurf ist auf den derzeit erkennbaren Produktstand von PerfectDay24 zugeschnitten:</p>
        <BulletList
          items={[
            "digitale Plattform fuer personalisierte Tagesplanung, Routen, Event- und Location-Empfehlungen",
            "Nutzerkonten, Gastzugang, Gruppenplanung, Sharing und Creator-/Route-Funktionen",
            "externe Ticket-, Reservierungs- oder Buchungslinks zu Drittanbietern",
            "moegliche Affiliate-Links und klar gekennzeichnete Sponsored-/Partner-Platzierungen",
            "derzeit kein erkennbarer eigener Verkauf von Tickets, Reservierungen oder Vor-Ort-Leistungen durch PerfectDay24",
            "Kernnutzung fuer Endnutzer aktuell grundsaetzlich unentgeltlich; spaetere Premium- oder Partnerprodukte sind moeglich",
          ]}
        />
      </LegalSection>

      <LegalSection title="Vor Veroeffentlichung zwingend ausfuellen">
        <BulletList
          items={[
            "Firma: [Rechtlicher Unternehmensname / Rechtsform]",
            "Anschrift: [Strasse, Hausnummer, PLZ, Ort, Land]",
            "Vertretungsberechtigte Person: [Geschaeftsfuehrer/in]",
            "E-Mail: [E-Mail-Adresse]",
            "Telefon: [optional]",
            "Handelsregister: [Amtsgericht / HRB, sobald vorhanden]",
            "USt-IdNr.: [falls vorhanden]",
            "Sitz / Gerichtsstand fuer Unternehmer: [Ort]",
          ]}
        />
      </LegalSection>

      <LegalSection title="Wichtige Hinweise vor Go-Live">
        <BulletList
          items={[
            "Falls ihr spaeter kostenpflichtige Abos, Premium-Funktionen oder Partnerpakete live schaltet, sollten diese AGB vor Freischaltung erweitert werden.",
            "Fuer entgeltliche B2C-Leistungen braucht ihr zusaetzlich eine saubere Widerrufsbelehrung und einen rechtssicheren Checkout.",
            "Datenschutz, Impressum und Cookie-/Tracking-Setup muessen separat rechtlich abgestimmt werden.",
            "Wegen Nutzerkonto, Profilen und personalisierten digitalen Leistungen sollte der finale Text vor Veroeffentlichung anwaltlich geprueft werden.",
          ]}
        />
      </LegalSection>

      <LegalSection title="1. Geltungsbereich">
        <OrderedList
          items={[
            <>
              Diese Allgemeinen Geschaeftsbedingungen gelten fuer die Nutzung der von
              <strong> [Rechtlicher Unternehmensname / Rechtsform]</strong>, <strong>[Anschrift]</strong>,
              vertreten durch <strong>[Geschaeftsfuehrer/in]</strong> (nachfolgend
              <strong> &quot;PerfectDay24&quot;</strong> oder <strong>&quot;wir&quot;</strong>),
              angebotenen Website, Web-App und sonstigen digitalen Dienste unter der Marke
              PerfectDay24.
            </>,
            "Die AGB gelten fuer unentgeltliche und, soweit gesondert angeboten, fuer entgeltliche digitale Leistungen von PerfectDay24.",
            "Die AGB gelten gegenueber Verbrauchern im Sinne des Paragrafen 13 BGB sowie gegenueber Unternehmern im Sinne des Paragrafen 14 BGB, soweit nicht in einzelnen Bestimmungen ausdruecklich differenziert wird.",
            "Abweichende Bedingungen des Nutzers gelten nur, wenn wir ihrer Geltung ausdruecklich in Textform zugestimmt haben.",
            "Fuer Vertraege ueber Leistungen Dritter, insbesondere Tickets, Reservierungen, Buchungen, Gastronomie-, Event-, Freizeit- oder touristische Angebote, gelten ausschliesslich die Bedingungen des jeweiligen Drittanbieters.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Leistungen von PerfectDay24">
        <OrderedList
          items={[
            "PerfectDay24 bietet eine digitale Plattform fuer personalisierte Tagesplanung, Routen- und Ablaufvorschlaege, Event- und Location-Empfehlungen, Creator-Routen, Gruppenabstimmung, Sharing-Funktionen sowie damit zusammenhaengende digitale Dienste.",
            "Die Inhalte und Vorschlaege koennen auf Nutzereingaben, Profilangaben, Interessen, Standortdaten, KI-gestuetzter Verarbeitung, eigenen kuratorischen Entscheidungen sowie Daten von Drittquellen beruhen.",
            "Unsere Leistungen dienen der Information, Inspiration und digitalen Planungshilfe. Sie stellen keine Garantie fuer Verfuegbarkeit, Eignung, Aktualitaet oder Durchfuehrbarkeit eines Vorschlags dar und keine individuelle rechtliche, medizinische, steuerliche oder sonstige Fachberatung.",
            "Angaben zu Oeffnungszeiten, Preisen, Verfuegbarkeiten, Einlassbedingungen, Altersfreigaben, Barrierefreiheit, Wetter, Verkehrszeiten, Auslastung oder kurzfristigen Aenderungen koennen sich jederzeit aendern. Nutzer sind verpflichtet, fuer sie wesentliche Informationen vor Inanspruchnahme eines Angebots selbst zu ueberpruefen.",
            "Soweit Kernfunktionen von PerfectDay24 unentgeltlich angeboten werden, besteht kein Anspruch auf die jederzeitige Beibehaltung eines bestimmten Funktionsumfangs. Gesetzliche Rechte von Verbrauchern bei digitalen Produkten bleiben unberuehrt.",
            "Wir sind berechtigt, Leistungen technisch, inhaltlich und gestalterisch weiterzuentwickeln, einzuschraenken oder zu aendern, soweit hierdurch kein Verstoss gegen zwingendes Recht vorliegt und berechtigte Interessen der Nutzer angemessen beruecksichtigt werden.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Registrierung, Nutzerkonto und Gastnutzung">
        <OrderedList
          items={[
            "Die Nutzung bestimmter Funktionen kann eine Registrierung und die Einrichtung eines Nutzerkontos erfordern. Andere Funktionen koennen gegebenenfalls auch ohne Registrierung als Gast genutzt werden.",
            "Bei der Registrierung sind saemtliche Angaben wahrheitsgemaess, aktuell und vollstaendig zu machen. Aenderungen wesentlicher Daten sind vom Nutzer unverzueglich zu aktualisieren.",
            "Die Registrierung ist nur voll geschaeftsfaehigen Personen erlaubt. Minderjaehrige duerfen registrierungspflichtige Funktionen nur mit Zustimmung ihrer gesetzlichen Vertreter nutzen.",
            "Zugangsdaten sind vertraulich zu behandeln und vor dem Zugriff Dritter zu schuetzen. Der Nutzer ist fuer alle Aktivitaeten verantwortlich, die ueber sein Konto veranlasst werden, sofern er den Missbrauch zu vertreten hat.",
            "Das Nutzerkonto ist nicht uebertragbar.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Vertragsschluss und Umfang der Nutzung">
        <OrderedList
          items={[
            "Der Nutzungsvertrag ueber unentgeltliche Leistungen kommt mit Abschluss der Registrierung oder, soweit keine Registrierung erforderlich ist, mit Beginn der Nutzung der Plattform zustande.",
            "Soweit PerfectDay24 entgeltliche Leistungen anbietet, werden Leistungsumfang, Preis, Laufzeit, etwaige Kuendigungsfristen und Zahlungsbedingungen vor Vertragsschluss gesondert angezeigt.",
            "Soweit Verbrauchern fuer entgeltliche Leistungen ein gesetzliches Widerrufsrecht zusteht, wird hierueber gesondert belehrt.",
            "Der Nutzer erhaelt fuer die Dauer des Vertrags ein einfaches, nicht ausschliessliches, nicht uebertragbares Recht, PerfectDay24 im vertraglich vorgesehenen Umfang fuer eigene rechtmaessige Zwecke zu nutzen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Zulaessige Nutzung und verbotene Handlungen">
        <OrderedList
          items={[
            "Die Nutzung von PerfectDay24 ist nur im Rahmen der geltenden Gesetze und dieser AGB zulaessig.",
            <>
              Dem Nutzer ist insbesondere untersagt:
              <div className="mt-3">
                <BulletList
                  items={[
                    "technische Schutzmassnahmen zu umgehen,",
                    "automatisierte Massenzugriffe, Scraping, Crawling oder Data-Mining ohne unsere vorherige Zustimmung vorzunehmen,",
                    "Schadcode, Bots oder sonstige stoerende Software einzusetzen,",
                    "Inhalte rechtswidrig, irrefuehrend, beleidigend, diskriminierend, gewaltverherrlichend oder sonst rechtsverletzend einzustellen,",
                    "die Plattform missbraeuchlich fuer Spam, unerlaubte Werbung oder systematische Stoerungen zu verwenden,",
                    "Inhalte oder Funktionen von PerfectDay24 ohne Erlaubnis kommerziell weiterzuverwerten, weiterzuverkaufen oder Dritten als eigenes Angebot bereitzustellen.",
                  ]}
                />
              </div>
            </>,
            "Wir sind berechtigt, bei konkreten Anhaltspunkten fuer eine rechtswidrige oder vertragswidrige Nutzung angemessene Massnahmen zu treffen, insbesondere Inhalte zu entfernen, Funktionen einzuschraenken oder Nutzerkonten vorlaeufig oder dauerhaft zu sperren.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Nutzerinhalte und Creator-Inhalte">
        <OrderedList
          items={[
            <>
              Soweit Nutzer Inhalte einstellen, hochladen, speichern, verknuepfen oder
              veroeffentlichen, insbesondere Profilangaben, Routentitel, Beschreibungen, Bilder,
              Empfehlungen, Kommentare oder sonstige Inhalte (nachfolgend zusammen
              <strong> &quot;Nutzerinhalte&quot;</strong>), verbleiben die Rechte hieran grundsaetzlich
              beim Nutzer.
            </>,
            "Der Nutzer raeumt PerfectDay24 an den Nutzerinhalten ein einfaches, unentgeltliches und raeumlich unbeschraenktes Nutzungsrecht ein, soweit dies fuer den Betrieb der Plattform, die technische Verarbeitung, die Speicherung, die Veroeffentlichung innerhalb der Plattform, die Darstellung gegenueber anderen Nutzern, die Fehleranalyse, die Sicherung sowie die Bewerbung der Plattform und der jeweiligen Inhalte erforderlich ist. Das Nutzungsrecht besteht fuer die Dauer der Bereitstellung des jeweiligen Nutzerinhalts und danach nur insoweit fort, wie dies fuer Sicherungskopien, gesetzliche Aufbewahrungspflichten oder bereits veranlasste Plattformdarstellungen erforderlich ist.",
            "Der Nutzer sichert zu, dass er ueber die fuer die Nutzung und Veroeffentlichung der Nutzerinhalte erforderlichen Rechte verfuegt und durch die Inhalte keine Rechte Dritter oder gesetzliche Vorschriften verletzt werden.",
            "Wir sind nicht verpflichtet, Nutzerinhalte inhaltlich vorab zu pruefen. Wir sind jedoch berechtigt, Nutzerinhalte bei Verdacht auf Rechtsverletzungen, Verstoss gegen diese AGB oder sonstigen berechtigten Gruenden zu sperren, zu entfernen oder ihre Sichtbarkeit einzuschraenken.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Verfuegbarkeit, technische Stoerungen und Aenderungen">
        <OrderedList
          items={[
            "PerfectDay24 bemueht sich um eine moeglichst hohe Verfuegbarkeit der Plattform. Ein Anspruch auf unterbrechungsfreie oder jederzeit fehlerfreie Verfuegbarkeit besteht jedoch nicht.",
            "Insbesondere Wartungsarbeiten, Sicherheitsupdates, Kapazitaetsengpaesse, technische Stoerungen, Stoerungen bei Drittanbietern oder hoehere Gewalt koennen zu voruebergehenden Einschraenkungen oder Ausfaellen fuehren.",
            "Soweit wir dauerhaft digitale Leistungen gegen Entgelt oder im rechtlich einschlaegigen Rahmen gegen Bereitstellung personenbezogener Daten bereitstellen, erfolgen Aenderungen dieser Leistungen nur im Rahmen der gesetzlichen Vorschriften.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Externe Angebote, Buchungen, Tickets und Reservierungen">
        <OrderedList
          items={[
            "PerfectDay24 kann auf externe Angebote Dritter verlinken oder entsprechende Deep Links, Ticket-Links, Reservierungslinks oder sonstige Weiterleitungen bereitstellen.",
            "Soweit nicht im Einzelfall ausdruecklich anders gekennzeichnet, wird PerfectDay24 dadurch nicht selbst Vertragspartner des ueber den Drittanbieter geschlossenen Geschaefts. Vertraege ueber Tickets, Reservierungen, Gastronomie-, Event-, Freizeit-, Reise- oder sonstige Drittleistungen kommen ausschliesslich zwischen dem Nutzer und dem jeweiligen Drittanbieter zustande.",
            "PerfectDay24 uebernimmt keine Verantwortung fuer Inhalt, Richtigkeit, Rechtmaessigkeit, Verfuegbarkeit, Preisgestaltung, Vertragserfuellung, Zahlung, Stornierung, Rueckabwicklung oder Maengel von Leistungen Dritter.",
            "Fuer die Nutzung und Buchung von Drittleistungen gelten ausschliesslich die Vertragsbedingungen, Datenschutzinformationen und sonstigen Regelungen des jeweiligen Drittanbieters.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Affiliate-Links, Werbung und gesponserte Platzierungen">
        <OrderedList
          items={[
            "PerfectDay24 kann Affiliate-Links, Partnerlinks, gesponserte Inhalte, Featured-Platzierungen oder sonstige kommerzielle Kommunikationen enthalten.",
            "Sofern PerfectDay24 fuer Klicks, Leads, Buchungen oder Abschluesse eine Verguetung oder Provision erhaelt, erfolgt dies im Rahmen der jeweiligen Partnerbeziehung. Entsprechende kommerzielle Inhalte oder Platzierungen werden nach den gesetzlichen Vorgaben als solche kenntlich gemacht.",
            "Die Existenz einer Partnerbeziehung bedeutet nicht automatisch, dass PerfectDay24 fuer die Leistungserbringung des Drittanbieters verantwortlich wird.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Entgelte und Zahlung bei kostenpflichtigen Leistungen">
        <OrderedList
          items={[
            "Soweit PerfectDay24 kostenpflichtige Leistungen anbietet, gelten die bei Vertragsschluss angezeigten Preise.",
            "Sofern nicht anders angegeben, verstehen sich Preise gegenueber Verbrauchern einschliesslich der gesetzlichen Umsatzsteuer.",
            "Zahlungen sind, soweit nicht anders vereinbart, unmittelbar mit Vertragsschluss faellig.",
            "Bei Zahlungsverzug sind wir berechtigt, den Zugang zu entgeltlichen Leistungen nach vorheriger Mahnung und angemessener Fristsetzung ganz oder teilweise zu sperren, soweit dem keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Laufzeit und Kuendigung">
        <OrderedList
          items={[
            "Der Vertrag ueber die unentgeltliche Nutzung von PerfectDay24 wird auf unbestimmte Zeit geschlossen und kann vom Nutzer jederzeit ohne Einhaltung einer Frist gekuendigt werden, etwa durch Loeschung des Kontos oder entsprechende Mitteilung in Textform.",
            "Wir koennen den Vertrag ueber unentgeltliche Leistungen mit angemessener Frist ordentlich kuendigen, soweit dem keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
            "Das Recht beider Parteien zur ausserordentlichen Kuendigung aus wichtigem Grund bleibt unberuehrt.",
            <>
              Ein wichtiger Grund fuer eine Sperrung oder ausserordentliche Kuendigung durch
              PerfectDay24 liegt insbesondere vor, wenn der Nutzer:
              <div className="mt-3">
                <BulletList
                  items={[
                    "bei der Registrierung falsche wesentliche Angaben macht,",
                    "gegen diese AGB oder geltendes Recht verstoesst,",
                    "die Plattform missbraeuchlich oder stoerend nutzt,",
                    "Rechte Dritter verletzt oder",
                    "im Falle entgeltlicher Leistungen trotz Mahnung faellige Zahlungen nicht leistet.",
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
              PerfectDay24 haftet unbeschraenkt:
              <div className="mt-3">
                <BulletList
                  items={[
                    "bei Vorsatz und grober Fahrlaessigkeit,",
                    "bei schuldhafter Verletzung des Lebens, des Koerpers oder der Gesundheit,",
                    "nach den Vorschriften des Produkthaftungsgesetzes sowie",
                    "in allen sonstigen Faellen, in denen eine unbeschraenkte Haftung gesetzlich zwingend vorgeschrieben ist.",
                  ]}
                />
              </div>
            </>,
            "Bei leicht fahrlaessiger Verletzung einer wesentlichen Vertragspflicht ist unsere Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfuellung die ordnungsgemaesse Durchfuehrung des Vertrags ueberhaupt erst ermoeglicht und auf deren Einhaltung der Nutzer regelmaessig vertrauen darf.",
            "Im Uebrigen ist die Haftung von PerfectDay24 fuer leicht fahrlaessige Pflichtverletzungen ausgeschlossen.",
            "Die vorstehenden Haftungsbeschraenkungen gelten entsprechend zugunsten unserer gesetzlichen Vertreter, Mitarbeitenden, Erfuellungsgehilfen und sonstigen Beauftragten.",
            "Soweit Informationen, Empfehlungen, Eventdaten, Oeffnungszeiten, Routenhinweise oder sonstige Inhalte ganz oder teilweise von Dritten stammen oder auf automatisierten Verfahren beruhen, haftet PerfectDay24 fuer deren inhaltliche Richtigkeit nur nach Massgabe der vorstehenden Absaetze.",
            "Gesetzliche Rechte von Verbrauchern bei Maengeln entgeltlicher digitaler Produkte bleiben unberuehrt.",
          ]}
        />
      </LegalSection>

      <LegalSection title="13. Datenschutz">
        <p>
          Informationen zur Verarbeitung personenbezogener Daten finden sich in unserer
          Datenschutzerklaerung.
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
              Ist der Nutzer Kaufmann, juristische Person des oeffentlichen Rechts oder
              oeffentlich-rechtliches Sondervermoegen, ist ausschliesslicher Gerichtsstand fuer alle
              Streitigkeiten aus oder im Zusammenhang mit diesem Vertragsverhaeltnis der Sitz von
              PerfectDay24, derzeit <strong>[Ort]</strong>.
            </>,
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
