import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Datenschutz | PerfectDay24",
  description: "Datenschutzerklärung für PerfectDay24.",
};

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AddressBlock({ lines }: { lines: string[] }) {
  return (
    <p>
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      title="Datenschutzerklärung"
      updatedAt="21. April 2026"
      intro="Diese Datenschutzerklärung informiert Sie darüber, welche personenbezogenen Daten wir bei der Nutzung von PerfectDay24 verarbeiten, zu welchen Zwecken dies geschieht, auf welcher Rechtsgrundlage wir dies tun und welche Rechte Ihnen zustehen."
    >
      <LegalSection title="Vor Veröffentlichung ergänzen und prüfen">
        <BulletList
          items={[
            "Rechtlicher Verantwortlicher, ladungsfähige Anschrift, E-Mail-Adresse und ggf. Vertretungsberechtigte ergänzen.",
            "Sofern ein Datenschutzbeauftragter bestellt ist: Kontaktdaten ergänzen.",
            "Hosting-Provider, Serverstandorte und konkrete Aufbewahrungsfristen für Server-Logs ergänzen.",
            "Prüfen, ob für nicht technisch erforderliche Tracking-/Attributionsfunktionen bereits ein wirksames Consent-Management eingesetzt wird.",
            "Prüfen, welche Aufbewahrungsfristen intern für Nutzerkonten, Pläne, Chats, Social-Daten und Affiliate-/Attributionsdaten verbindlich gelten.",
            "Prüfen, auf welcher vertraglichen Grundlage internationale Datentransfers mit OpenAI und weiteren Anbietern abgesichert sind.",
            "Zuständige Datenschutzaufsichtsbehörde des Verantwortlichen ergänzen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Einleitung">
        <p>
          Wir freuen uns über Ihr Interesse an <strong>perfectday24</strong>. Der Schutz Ihrer
          personenbezogenen Daten ist uns wichtig. Nachfolgend informieren wir Sie darüber, welche
          personenbezogenen Daten wir bei der Nutzung von <strong>perfectday24</strong> verarbeiten,
          zu welchen Zwecken dies geschieht, auf welcher Rechtsgrundlage wir dies tun und welche Rechte
          Ihnen zustehen.
        </p>
      </LegalSection>

      <LegalSection title="1. Verantwortlicher">
        <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
        <AddressBlock
          lines={[
            "[Rechtlicher Name / Unternehmen]",
            "[Anschrift]",
            "[PLZ Ort]",
            "[Land]",
            "E-Mail: [Datenschutz-/Kontakt-E-Mail]",
            "Telefon: [optional]",
          ]}
        />
        <p>Sofern ein Datenschutzbeauftragter bestellt ist, ist dieser erreichbar unter:</p>
        <p>[Name / Funktion, Anschrift oder E-Mail des Datenschutzbeauftragten]</p>
      </LegalSection>

      <LegalSection title="2. Begriffsbestimmung und Rechtsgrundlagen">
        <p>
          Wir verarbeiten personenbezogene Daten ausschließlich im Rahmen der geltenden
          datenschutzrechtlichen Vorschriften. Soweit in dieser Datenschutzerklärung nicht anders
          angegeben, stützen wir die Datenverarbeitung auf folgende Rechtsgrundlagen:
        </p>
        <BulletList
          items={[
            "Art. 6 Abs. 1 lit. b DSGVO, soweit die Verarbeitung für die Erfüllung eines Vertrags oder zur Durchführung vorvertraglicher Maßnahmen erforderlich ist.",
            "Art. 6 Abs. 1 lit. f DSGVO, soweit die Verarbeitung zur Wahrung unserer berechtigten Interessen erforderlich ist und keine überwiegenden Interessen, Grundrechte oder Grundfreiheiten der betroffenen Personen entgegenstehen.",
            "Art. 6 Abs. 1 lit. a DSGVO, soweit Sie uns eine Einwilligung erteilt haben.",
            "Art. 6 Abs. 1 lit. c DSGVO, soweit wir rechtlich verpflichtet sind.",
          ]}
        />
        <p>
          Soweit beim Speichern oder Auslesen von Informationen auf Ihrem Endgerät Vorschriften des
          Telekommunikation-Digitale-Dienste-Datenschutz-Gesetzes (TDDDG) einschlägig sind, erfolgt
          dies entweder auf Grundlage Ihrer Einwilligung oder, soweit technisch erforderlich, nach den
          gesetzlichen Ausnahmen für unbedingt erforderliche Vorgänge.
        </p>
      </LegalSection>

      <LegalSection title="3. Datenverarbeitung bei der informatorischen Nutzung der Website">
        <p>
          Bei Aufruf unserer Website werden technisch erforderliche Verbindungs- und
          Kommunikationsdaten verarbeitet, damit die Inhalte ausgeliefert und die Stabilität sowie
          Sicherheit der Website gewährleistet werden können. Hierzu können insbesondere
          IP-Adresse, Datum und Uhrzeit des Zugriffs, angeforderte Inhalte, Informationen zum Browser
          und Betriebssystem sowie Referrer-Informationen gehören.
        </p>
        <p>Die konkrete Ausgestaltung richtet sich nach dem eingesetzten Hosting-Provider:</p>
        <BulletList
          items={[
            "Hosting-Provider: [bitte ergänzen]",
            "Serverstandort(e): [bitte ergänzen]",
            "Aufbewahrungsfrist für Logdaten: [bitte ergänzen]",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes
          Interesse liegt in der sicheren, stabilen und performanten Bereitstellung unseres
          Online-Angebots.
        </p>
      </LegalSection>

      <LegalSection title="4. Browser-Speicher, lokale Einstellungen und technisch erforderliche Endgerätezugriffe">
        <p>
          <strong>perfectday24</strong> nutzt Browser-Speicher wie <strong>localStorage</strong> und
          <strong> sessionStorage</strong>, um Funktionen bereitzustellen und Ihre Eingaben bzw.
          Einstellungen zwischenzuspeichern. Dazu gehören insbesondere:
        </p>
        <BulletList
          items={[
            "Auswahl von Stadt, Land, Planungsmodus, Datum und Routenprofil.",
            "Speicherung eines manuellen Startpunkts und weiterer Planner-Einstellungen.",
            "Zwischenspeicherung von Gruppen- und Planungsentwürfen.",
            "Komfortfunktionen auf Share-Seiten, etwa lokal gespeicherte Namen für Abstimmungen oder Änderungswünsche.",
            "Pseudonyme anonyme bzw. sitzungsbezogene Kennungen für Monetarisierungs- und Attributionsfunktionen.",
          ]}
        />
        <p>
          Soweit diese Speicherungen für die von Ihnen ausdrücklich gewünschten Funktionen
          erforderlich sind, erfolgt die Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. b bzw.
          lit. f DSGVO sowie, soweit einschlägig, auf Grundlage der gesetzlichen Ausnahmen für
          technisch erforderliche Endgerätezugriffe.
        </p>
        <p>
          Soweit nicht technisch erforderliche Tracking- oder Attributionskennungen eingesetzt werden,
          sollte dies nur auf Basis einer wirksamen Einwilligung erfolgen. Vor dem Produktivgang ist
          daher zu prüfen, ob für diese Verarbeitungen ein passendes Consent-Management aktiv ist.
        </p>
      </LegalSection>

      <LegalSection title="5. Registrierung, Anmeldung und Authentifizierung">
        <p>
          Sie können <strong>perfectday24</strong> mit einem Nutzerkonto oder teilweise auch als Gast
          nutzen. Für Registrierung und Authentifizierung verwenden wir <strong>Supabase</strong>.
        </p>
        <p>Dabei können insbesondere folgende Daten verarbeitet werden:</p>
        <BulletList
          items={[
            "E-Mail-Adresse",
            "Passwort bzw. passwortbezogene Authentifizierungsdaten",
            "Nutzer-ID",
            "Angaben aus verbundenen Login-Providern",
            "Sitzungs- und Authentifizierungsinformationen",
          ]}
        />
        <p>Aktuell sind je nach Konfiguration insbesondere folgende Anmeldewege vorgesehen:</p>
        <BulletList
          items={[
            "E-Mail und Passwort",
            "anonymer Gastzugang",
            "OAuth-Anmeldung über Google",
            "OAuth-Anmeldung über Microsoft",
          ]}
        />
        <p>
          Bei einer OAuth-Anmeldung können uns vom jeweiligen Anbieter zusätzlich Profildaten
          übermittelt werden, etwa Name, E-Mail-Adresse oder Avatar-URL, soweit Sie diese Freigabe
          gegenüber dem Anbieter erteilt haben.
        </p>
        <p>
          Die Verarbeitung erfolgt zur Einrichtung und Verwaltung Ihres Nutzerkontos sowie zur
          Erbringung der von Ihnen angeforderten Funktionen auf Grundlage von Art. 6 Abs. 1 lit. b
          DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="6. Nutzung als Gast">
        <p>
          Wenn Sie <strong>perfectday24</strong> als Gast nutzen, verarbeiten wir eine pseudonyme
          Nutzerkennung, um Gastfunktionen bereitzustellen und eine spätere Übernahme bestimmter
          Einstellungen oder Daten in ein reguläres Konto zu ermöglichen.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="7. Profil, Interessen und öffentliche Creator-Profile">
        <p>Im Rahmen Ihres Profils können wir insbesondere folgende Daten verarbeiten:</p>
        <BulletList
          items={[
            "Anzeigename",
            "Benutzername",
            "Profilbild / Avatar",
            "Biografie",
            "Interessen und Vorlieben",
            "öffentliche Creator-/Profilangaben",
            "verknüpfte Social-/Profilmetriken",
          ]}
        />
        <p>
          Wenn Sie ein öffentlich sichtbares Profil oder eine öffentliche Route anlegen, können
          bestimmte Angaben für andere Nutzerinnen und Nutzer oder für Besucher öffentlicher Seiten
          sichtbar sein. Dies betrifft insbesondere Benutzername, Anzeigename, Avatar, Bio sowie
          freigegebene Routen und damit verbundene aggregierte Kennzahlen.
        </p>
        <p>
          Die Verarbeitung erfolgt zur Bereitstellung der Profil- und Community-Funktionen auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="8. Planer, Vorlieben, Startpunkte und Standortdaten">
        <p>
          Im Planner verarbeiten wir die Daten, die Sie für die Erstellung eines Plans eingeben oder
          auswählen. Dazu gehören insbesondere:
        </p>
        <BulletList
          items={[
            "gewählte Stadt und Land",
            "Datum, Anlass, Budget, Erlebnismodus und weitere Planner-Parameter",
            "Interessen und Gruppenpräferenzen",
            "manueller Startpunkt mit Bezeichnung und Koordinaten",
            "optional der aktuelle Standort, wenn Sie die Standortfreigabe in Ihrem Browser erteilen",
            "Planvarianten, Stops, Begründungen und Zusammenfassungen",
          ]}
        />
        <p>
          Wenn Sie die Funktion &quot;aktueller Standort&quot; nutzen, wird Ihr Standort nur verarbeitet, wenn
          Sie dies über die Browser- bzw. Geräteeinstellungen freigeben und die Funktion aktiv
          verwenden. Wir nutzen den Standort für die Ermittlung des geeigneten Ausgangspunkts Ihrer
          Planung.
        </p>
        <p>
          Die Verarbeitung erfolgt zur Erbringung der Planner-Funktion auf Grundlage von Art. 6
          Abs. 1 lit. b DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="9. Startpunkt-Suche und Geocoding">
        <p>
          Wenn Sie einen Startpunkt manuell suchen, verarbeiten wir Ihre Suchanfrage und gleichen diese
          mit internen Orts- und Stadtdaten ab, um Vorschläge für Adressen, Hotels, Bahnhöfe,
          Flughäfen oder andere Startpunkte anzuzeigen.
        </p>
        <p>Verarbeitet werden dabei insbesondere:</p>
        <BulletList
          items={[
            "Suchbegriff",
            "gewählter Ortstyp",
            "Stadtbezug",
            "Koordinaten und Bezeichnungen der Treffer",
          ]}
        />
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="10. Gespeicherte Pläne">
        <p>Wenn Sie einen Plan speichern, verarbeiten wir insbesondere:</p>
        <BulletList
          items={[
            "Titel des Plans",
            "Filter- und Planungseinstellungen",
            "effektiven Radius und Sortierung",
            "ausgewählte Stops mit Bezeichnungen, Notizen, Dauer, Koordinaten und externen Links",
            "Gruppenbezug und Varianteninformationen",
            "eine gegebenenfalls erzeugte KI-Beschreibung des Plans",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt zur Speicherung und späteren Wiederverwendung Ihrer Planungen auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="11. Geteilte Pläne und Share-Links">
        <p>
          Sie können Pläne über einen individuellen Share-Link teilen. Dabei wird ein eindeutiger
          Share-Token erzeugt. Jeder, der über diesen Link verfügt, kann den freigegebenen Plan
          aufrufen. Bitte teilen Sie solche Links daher nur mit Personen, für die der Plan bestimmt
          ist.
        </p>
        <p>Auf öffentlichen Share-Seiten können insbesondere folgende Inhalte sichtbar sein:</p>
        <BulletList
          items={[
            "Titel und Inhalte des geteilten Plans",
            "Startpunktbezeichnung",
            "gespeicherte Stops und Beschreibungen",
            "gegebenenfalls die KI-generierte Planbeschreibung",
            "gemeinschaftliche Wahl-/Abstimmungsinformationen",
            "Änderungswünsche der Gruppe",
          ]}
        />
        <p>Andere Personen können auf Share-Seiten zudem:</p>
        <BulletList
          items={[
            "ihren Namen für Abstimmungen angeben",
            "Änderungswünsche mit Namensangabe und Nachricht hinterlassen",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern die Teilung
          und Zusammenarbeit von Ihnen initiiert wurde.
        </p>
      </LegalSection>

      <LegalSection title="12. Gruppenfunktionen, Freundschaften, Follows und soziale Interaktion">
        <p>
          <strong>perfectday24</strong> enthält soziale und kollaborative Funktionen. Dabei können
          insbesondere folgende Daten verarbeitet werden:
        </p>
        <BulletList
          items={[
            "Freundschaftsbeziehungen zwischen Nutzerkonten",
            "Follow-Beziehungen zu Profilen bzw. Creator-Profilen",
            "gespeicherte Gruppen und Gruppenmitglieder",
            "Gruppenbezogene Planungsdaten",
            "Reaktionen auf gemeinsame Planentscheidungen",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt zur Bereitstellung der von Ihnen genutzten Social- und
          Kollaborationsfunktionen auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="13. Chats und Nachrichten">
        <p>Wenn Sie Chat- oder Messaging-Funktionen nutzen, verarbeiten wir insbesondere:</p>
        <BulletList
          items={[
            "Teilnehmerdaten",
            "Chat-Zuordnungen",
            "Nachrichteninhalte",
            "Zeitstempel",
            "technisch erforderliche Statusdaten wie zuletzt gelesene Nachricht oder ungelesene Nachrichtenanzahl",
          ]}
        />
        <p>
          Dies kann Direktnachrichten ebenso betreffen wie Gruppenchats zu gemeinsam bearbeiteten
          Plänen. Systemnachrichten, die aus Gruppenaktionen entstehen, können ebenfalls gespeichert
          werden.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="14. Creator-Routen, Likes, Bookmarks und Bewertungen">
        <p>Wenn Sie Routen erstellen oder mit Routen interagieren, verarbeiten wir insbesondere:</p>
        <BulletList
          items={[
            "Routentitel, Beschreibungen, Stops, Notizen und Koordinaten",
            "Sichtbarkeitseinstellungen",
            "Likes",
            "Bookmarks",
            "Bewertungen und optionale Bewertungstexte",
            "aggregierte Kennzahlen wie Like-, Bookmark- oder Bewertungsanzahl",
          ]}
        />
        <p>
          Bei öffentlichen oder ungelisteten Routen können Inhalte für andere Nutzerinnen und
          Nutzer sichtbar sein.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="15. Karten, Routing und externe Kartendienste">
        <p>
          Bei Nutzung von Karten- und Routing-Funktionen werden technische Anfragen an externe
          Kartendienste bzw. Infrastruktur-Anbieter übermittelt. Nach aktuellem Projektstand betrifft
          dies insbesondere:
        </p>
        <BulletList
          items={[
            "OpenStreetMap für Kartentiles",
            "OSRM (router.project-osrm.org) für Routenberechnungen",
            "ein CDN für Leaflet-Marker-Ressourcen",
          ]}
        />
        <p>
          Dabei wird insbesondere Ihre IP-Adresse sowie die für die Kartendarstellung bzw.
          Routenberechnung erforderliche Anfrage an den jeweiligen Anbieter übermittelt. Wenn Sie
          Karten oder Routen nicht nutzen, findet diese Übermittlung grundsätzlich nicht statt.
        </p>
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 6 Abs. 1
          lit. f DSGVO. Unser berechtigtes Interesse liegt in der funktionsfähigen Darstellung von
          Karten und Wegen innerhalb des Produkts.
        </p>
      </LegalSection>

      <LegalSection title="16. Externe Links und Weiterleitungen, insbesondere Google Maps und Partnerlinks">
        <p>
          <strong>perfectday24</strong> kann externe Links zu Drittangeboten enthalten, etwa zu
          Reservierungsseiten, Ticketseiten, Partnerangeboten oder zu Google Maps. Wenn Sie einen
          solchen Link anklicken, verlassen Sie unser Angebot oder werden über eine von uns
          bereitgestellte Weiterleitungsstrecke zu dem externen Ziel weitergeleitet.
        </p>
        <p>Dabei können insbesondere verarbeitet werden:</p>
        <BulletList
          items={[
            "Ziel-URL",
            "pseudonyme Sitzungs- oder Attributionskennungen",
            "Bezugsdaten zum Plan, Ort, Event oder Partner",
            "Zeitpunkt des Klicks",
          ]}
        />
        <p>
          Die eigentliche weitere Verarbeitung auf der Zielseite erfolgt ausschließlich durch den
          jeweiligen Drittanbieter.
        </p>
      </LegalSection>

      <LegalSection title="17. Affiliate-, Attributions- und Monetarisierungsfunktionen">
        <p>
          <strong>perfectday24</strong> enthält Funktionen zur Messung von Partnerinteraktionen,
          Affiliate-Klicks und anderen monetarisierungsnahen Ereignissen. Dabei können insbesondere
          folgende Daten verarbeitet werden:
        </p>
        <BulletList
          items={[
            "Nutzer-ID oder pseudonyme anonyme Kennung",
            "Sitzungskennung",
            "bezogene Plan-, Routen-, Event-, Orts- oder Partner-ID",
            "verwendete Fläche innerhalb des Produkts",
            "Event-Typ, etwa Klick, Share-Aktivierung, Plan-Speicherung oder Conversion-nahe Handlung",
            "Zeitstempel",
            "technische Zusatzinformationen in Metadaten",
          ]}
        />
        <p>
          Diese Daten dienen dazu, Partnerinteraktionen nachzuvollziehen, Affiliate- oder
          Kampagnenlogiken technisch abzubilden, Missbrauch zu begrenzen sowie interne Produkt- und
          Erlösmodelle auszuwerten.
        </p>
        <p>
          Die Verarbeitung stützen wir grundsätzlich auf Art. 6 Abs. 1 lit. f DSGVO. Soweit im
          Rahmen dieser Funktionen nicht technisch erforderliche Kennungen auf dem Endgerät
          gespeichert oder ausgelesen werden, sollte dies nur nach vorheriger Einwilligung erfolgen.
        </p>
      </LegalSection>

      <LegalSection title="18. KI-gestützte Textgenerierung mit OpenAI">
        <p>
          Wenn Sie die Funktion zur KI-gestützten Generierung von Plantexten nutzen, übermitteln wir
          die für die Textgenerierung erforderlichen Planungsdaten an <strong>OpenAI</strong>. Dazu
          können insbesondere gehören:
        </p>
        <BulletList
          items={[
            "Planparameter wie Budget, Anlass, Modus und Interessen",
            "ausgewählte Stops und Slot-Informationen",
            "Bezeichnungen, Kategorien, Distanzen und sonstige planrelevante Angaben",
          ]}
        />
        <p>
          Die Nutzung der KI-Funktion erfolgt nur, wenn Sie diese aktiv anstoßen. Bitte geben Sie in
          diesem Zusammenhang keine sensiblen oder sonst besonders schutzbedürftigen Daten ein, sofern
          dies nicht zwingend erforderlich ist.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Soweit es bei der Nutzung des Dienstleisters
          zu Datenübermittlungen in Drittländer kommt, erfolgt dies vorbehaltlich geeigneter
          Garantien. Die konkrete vertragliche und organisatorische Ausgestaltung mit OpenAI ist vor
          Veröffentlichung abschließend zu prüfen und hier gegebenenfalls zu ergänzen.
        </p>
      </LegalSection>

      <LegalSection title="19. Einsatz von Supabase">
        <p>
          Für Datenbank-, Authentifizierungs- und Speicherfunktionen nutzen wir
          <strong> Supabase</strong>. Über Supabase können insbesondere folgende
          Verarbeitungsvorgänge erfolgen:
        </p>
        <BulletList
          items={[
            "Nutzer-Authentifizierung",
            "Speicherung von Profildaten",
            "Speicherung von Plänen, Gruppen, Chat-Daten und Social-Daten",
            "Speicherung von Avataren und sonstigen Dateien",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt zur technischen Bereitstellung unserer Plattform und damit auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p>
          Anbieter, Anschrift, Region und gegebenenfalls eingesetzte Unterauftragsverarbeiter sind vor
          Veröffentlichung dieser Datenschutzerklärung konkret zu ergänzen:
        </p>
        <BulletList
          items={[
            "Anbieter: [bitte ergänzen]",
            "Anschrift: [bitte ergänzen]",
            "Region / Serverstandort: [bitte ergänzen]",
          ]}
        />
      </LegalSection>

      <LegalSection title="20. Versand von Transaktions-E-Mails (Resend)">
        <p>
          Für den Versand von Transaktions-E-Mails — insbesondere Registrierungsbestätigungen,
          E-Mails zum Zurücksetzen des Passworts sowie sicherheitsbezogene Konto-Benachrichtigungen —
          nutzen wir den Dienst <strong>Resend</strong> (Resend, Inc., USA). Der Versand erfolgt über
          Infrastruktur in der Europäischen Union (Region Irland).
        </p>
        <p>Dabei können folgende Daten verarbeitet werden:</p>
        <BulletList
          items={[
            "E-Mail-Adresse des Empfängers",
            "Inhalt und Betreff der jeweiligen Nachricht",
            "technische Zustellmetadaten (z. B. Zustellstatus, Zeitpunkt)",
          ]}
        />
        <p>
          Die Verarbeitung ist für die Bereitstellung des Nutzerkontos erforderlich und erfolgt auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Soweit dabei eine Übermittlung in die USA nicht
          ausgeschlossen werden kann, erfolgt diese auf Grundlage geeigneter Garantien
          (EU-Standardvertragsklauseln); die konkrete vertragliche Ausgestaltung mit Resend ist vor
          Veröffentlichung dieser Datenschutzerklärung zu prüfen.
        </p>
      </LegalSection>

      <LegalSection title="21. Reichweitenmessung mit Plausible Analytics">
        <p>
          Zur Auswertung der Nutzung unserer Website setzen wir <strong>Plausible Analytics</strong>
          ein (Plausible Insights OÜ, Estland). Die Verarbeitung findet ausschließlich auf Servern in
          der Europäischen Union statt. Die Auslieferung erfolgt über unsere eigene Domain, es werden
          also keine Verbindungsdaten an einen weiteren Drittanbieter übertragen.
        </p>
        <p>
          Plausible verzichtet vollständig auf Cookies und speichert keinerlei Informationen auf
          Ihrem Endgerät. Es findet keine geräteübergreifende Wiedererkennung und keine Bildung von
          Nutzerprofilen statt. Erhoben werden ausschließlich aggregierte Angaben:
        </p>
        <BulletList
          items={[
            "aufgerufene Seite und verweisende Seite (Referrer)",
            "Land, abgeleitet aus der IP-Adresse — die IP-Adresse selbst wird nicht gespeichert",
            "Gerätetyp, Betriebssystem und Browser in grober Kategorie",
            "Auslösen bestimmter Funktionen, etwa das Erstellen, Speichern oder Teilen eines Plans (ohne Inhalt des Plans)",
          ]}
        />
        <p>
          Ein Personenbezug wird dabei nicht hergestellt; ein Rückschluss auf einzelne Personen ist
          uns nicht möglich. Da kein Zugriff auf Informationen in Ihrem Endgerät erfolgt, ist eine
          Einwilligung nach § 25 Abs. 1 TTDSG nicht erforderlich. Rechtsgrundlage ist unser
          berechtigtes Interesse an einer datensparsamen statistischen Auswertung und an der
          bedarfsgerechten Weiterentwicklung unseres Angebots nach Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="22. Empfänger von Daten">
        <p>Empfänger Ihrer Daten können insbesondere sein:</p>
        <BulletList
          items={[
            "Hosting-Provider",
            "Supabase als Infrastruktur- und Datenbankdienstleister",
            "Resend als E-Mail-Versanddienstleister",
            "Plausible Analytics als Anbieter der cookielosen Reichweitenmessung (EU)",
            "OpenAI bei Nutzung der KI-Textfunktion",
            "Anbieter externer Karten-, Routing- und Linkziele",
            "gegebenenfalls Partner- und Affiliate-Anbieter, soweit Sie entsprechende Links aktiv nutzen",
          ]}
        />
        <p>
          Wir übermitteln personenbezogene Daten nur insoweit, wie dies für die jeweiligen Funktionen
          erforderlich ist oder eine rechtliche Verpflichtung besteht.
        </p>
      </LegalSection>

      <LegalSection title="23. Drittlandübermittlungen">
        <p>
          Soweit wir Dienstleister oder Angebote einsetzen, bei denen eine Übermittlung
          personenbezogener Daten in Staaten außerhalb der Europäischen Union bzw. des Europäischen
          Wirtschaftsraums nicht ausgeschlossen werden kann, erfolgt eine solche Übermittlung nur
          unter Beachtung der gesetzlichen Voraussetzungen.
        </p>
        <p>
          Dies kann insbesondere durch Angemessenheitsbeschlüsse oder geeignete Garantien wie
          Standardvertragsklauseln erfolgen, soweit erforderlich. Die konkret eingesetzten
          Transfermechanismen sollten vor Livegang dokumentiert und hier ergänzt werden.
        </p>
      </LegalSection>

      <LegalSection title="24. Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie dies für die jeweiligen Zwecke
          erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
        </p>
        <p>Nach aktuellem Produktstand gelten insbesondere folgende Grundsätze:</p>
        <BulletList
          items={[
            "Kontodaten speichern wir für die Dauer des Bestehens Ihres Nutzerkontos.",
            "Profil-, Plan-, Routen-, Gruppen- und Chat-Daten speichern wir grundsätzlich so lange, bis Sie Inhalte löschen oder Ihr Konto entfernt wird, soweit keine gesetzlichen Pflichten entgegenstehen.",
            "Öffentlich freigegebene Inhalte und Share-Daten bleiben sichtbar, solange die zugrunde liegenden Inhalte bzw. Freigaben bestehen.",
            "Lokale Browser-Speicherungen verbleiben grundsätzlich auf Ihrem Endgerät, bis Sie diese löschen oder sie durch Ihren Browser entfernt werden.",
            "Attributions- und Monetarisierungsdaten sollten vor Veröffentlichung mit konkreten Lösch- bzw. Prüffristen hinterlegt werden.",
          ]}
        />
        <p>Die finalen Fristen sind intern festzulegen und an dieser Stelle zu konkretisieren.</p>
      </LegalSection>

      <LegalSection title="25. Ihre Rechte">
        <p>Sie haben nach Maßgabe der gesetzlichen Voraussetzungen insbesondere folgende Rechte:</p>
        <BulletList
          items={[
            "Recht auf Auskunft gemäß Art. 15 DSGVO",
            "Recht auf Berichtigung gemäß Art. 16 DSGVO",
            "Recht auf Löschung gemäß Art. 17 DSGVO",
            "Recht auf Einschränkung der Verarbeitung gemäß Art. 18 DSGVO",
            "Recht auf Datenübertragbarkeit gemäß Art. 20 DSGVO",
            "Recht auf Widerspruch gemäß Art. 21 DSGVO",
            "Recht auf Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft",
          ]}
        />
        <p>
          Zur Ausübung Ihrer Rechte können Sie uns jederzeit unter den oben genannten Kontaktdaten
          kontaktieren.
        </p>
      </LegalSection>

      <LegalSection title="26. Beschwerderecht bei einer Aufsichtsbehörde">
        <p>
          Sie haben außerdem das Recht, sich bei einer Datenschutzaufsichtsbehörde über die
          Verarbeitung Ihrer personenbezogenen Daten durch uns zu beschweren.
        </p>
        <p>Zuständige Aufsichtsbehörde:</p>
        <p>[bitte zuständige Landesdatenschutzbehörde des Verantwortlichen ergänzen]</p>
      </LegalSection>

      <LegalSection title="27. Pflicht zur Bereitstellung von Daten">
        <p>
          Die Bereitstellung personenbezogener Daten ist teilweise für die Nutzung einzelner
          Funktionen von <strong>perfectday24</strong> erforderlich. Ohne bestimmte Daten können wir
          insbesondere Konto-, Planer-, Gruppen-, Share- oder Chat-Funktionen unter Umständen nicht
          oder nur eingeschränkt bereitstellen.
        </p>
        <p>
          Die Bereitstellung von Standortdaten, Profilangaben, öffentlichen Inhalten oder
          KI-bezogenen Eingaben ist dagegen in der Regel freiwillig, kann jedoch für die jeweilige
          Funktion erforderlich sein, wenn Sie diese aktiv nutzen möchten.
        </p>
      </LegalSection>

      <LegalSection title="28. Änderungen dieser Datenschutzerklärung">
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, wenn dies aufgrund
          technischer, rechtlicher oder organisatorischer Änderungen erforderlich wird. Es gilt die
          jeweils auf unserer Website veröffentlichte Fassung.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
