import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Datenschutz | PerfectDay24",
  description: "Datenschutzerklaerung fuer PerfectDay24 auf Basis des Arbeitsentwurfs vom 21.04.2026.",
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
      title="Datenschutzerklaerung"
      updatedAt="21. April 2026"
      intro="Diese Seite basiert inhaltlich nahezu vollstaendig auf dem internen Arbeitsentwurf vom 21.04.2026. Sie ist bewusst detailliert gehalten, damit die spaetere Live-Fassung dieselbe Struktur wie der Fachentwurf behaelt. Alle Platzhalter in eckigen Klammern muessen vor dem oeffentlichen Launch ersetzt und rechtlich geprueft werden."
    >
      <LegalSection title="Vor Veroeffentlichung ergaenzen und pruefen">
        <BulletList
          items={[
            "Rechtlicher Verantwortlicher, ladungsfaehige Anschrift, E-Mail-Adresse und ggf. Vertretungsberechtigte ergaenzen.",
            "Sofern ein Datenschutzbeauftragter bestellt ist: Kontaktdaten ergaenzen.",
            "Hosting-Provider, Serverstandorte und konkrete Aufbewahrungsfristen fuer Server-Logs ergaenzen.",
            "Pruefen, ob fuer nicht technisch erforderliche Tracking-/Attributionsfunktionen bereits ein wirksames Consent-Management eingesetzt wird.",
            "Pruefen, welche Aufbewahrungsfristen intern fuer Nutzerkonten, Plaene, Chats, Social-Daten und Affiliate-/Attributionsdaten verbindlich gelten.",
            "Pruefen, auf welcher vertraglichen Grundlage internationale Datentransfers mit OpenAI und weiteren Anbietern abgesichert sind.",
            "Zustaendige Datenschutzaufsichtsbehoerde des Verantwortlichen ergaenzen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Einleitung">
        <p>
          Wir freuen uns ueber Ihr Interesse an <strong>perfectday24</strong>. Der Schutz Ihrer
          personenbezogenen Daten ist uns wichtig. Nachfolgend informieren wir Sie darueber, welche
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
          Wir verarbeiten personenbezogene Daten ausschliesslich im Rahmen der geltenden
          datenschutzrechtlichen Vorschriften. Soweit in dieser Datenschutzerklaerung nicht anders
          angegeben, stuetzen wir die Datenverarbeitung auf folgende Rechtsgrundlagen:
        </p>
        <BulletList
          items={[
            "Art. 6 Abs. 1 lit. b DSGVO, soweit die Verarbeitung fuer die Erfuellung eines Vertrags oder zur Durchfuehrung vorvertraglicher Massnahmen erforderlich ist.",
            "Art. 6 Abs. 1 lit. f DSGVO, soweit die Verarbeitung zur Wahrung unserer berechtigten Interessen erforderlich ist und keine ueberwiegenden Interessen, Grundrechte oder Grundfreiheiten der betroffenen Personen entgegenstehen.",
            "Art. 6 Abs. 1 lit. a DSGVO, soweit Sie uns eine Einwilligung erteilt haben.",
            "Art. 6 Abs. 1 lit. c DSGVO, soweit wir rechtlich verpflichtet sind.",
          ]}
        />
        <p>
          Soweit beim Speichern oder Auslesen von Informationen auf Ihrem Endgeraet Vorschriften des
          Telekommunikation-Digitale-Dienste-Datenschutz-Gesetzes (TDDDG) einschlaegig sind, erfolgt
          dies entweder auf Grundlage Ihrer Einwilligung oder, soweit technisch erforderlich, nach den
          gesetzlichen Ausnahmen fuer unbedingt erforderliche Vorgange.
        </p>
      </LegalSection>

      <LegalSection title="3. Datenverarbeitung bei der informatorischen Nutzung der Website">
        <p>
          Bei Aufruf unserer Website werden technisch erforderliche Verbindungs- und
          Kommunikationsdaten verarbeitet, damit die Inhalte ausgeliefert und die Stabilitaet sowie
          Sicherheit der Website gewaehrleistet werden koennen. Hierzu koennen insbesondere
          IP-Adresse, Datum und Uhrzeit des Zugriffs, angeforderte Inhalte, Informationen zum Browser
          und Betriebssystem sowie Referrer-Informationen gehoeren.
        </p>
        <p>Die konkrete Ausgestaltung richtet sich nach dem eingesetzten Hosting-Provider:</p>
        <BulletList
          items={[
            "Hosting-Provider: [bitte ergaenzen]",
            "Serverstandort(e): [bitte ergaenzen]",
            "Aufbewahrungsfrist fuer Logdaten: [bitte ergaenzen]",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes
          Interesse liegt in der sicheren, stabilen und performanten Bereitstellung unseres
          Online-Angebots.
        </p>
      </LegalSection>

      <LegalSection title="4. Browser-Speicher, lokale Einstellungen und technisch erforderliche Endgeraetezugriffe">
        <p>
          <strong>perfectday24</strong> nutzt Browser-Speicher wie <strong>localStorage</strong> und
          <strong> sessionStorage</strong>, um Funktionen bereitzustellen und Ihre Eingaben bzw.
          Einstellungen zwischenzuspeichern. Dazu gehoeren insbesondere:
        </p>
        <BulletList
          items={[
            "Auswahl von Stadt, Land, Planungsmodus, Datum und Routenprofil.",
            "Speicherung eines manuellen Startpunkts und weiterer Planner-Einstellungen.",
            "Zwischenspeicherung von Gruppen- und Planungsentwuerfen.",
            "Komfortfunktionen auf Share-Seiten, etwa lokal gespeicherte Namen fuer Abstimmungen oder Aenderungswuensche.",
            "Pseudonyme anonyme bzw. sitzungsbezogene Kennungen fuer Monetarisierungs- und Attributionsfunktionen.",
          ]}
        />
        <p>
          Soweit diese Speicherungen fuer die von Ihnen ausdruecklich gewuenschten Funktionen
          erforderlich sind, erfolgt die Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. b bzw.
          lit. f DSGVO sowie, soweit einschlaegig, auf Grundlage der gesetzlichen Ausnahmen fuer
          technisch erforderliche Endgeraetezugriffe.
        </p>
        <p>
          Soweit nicht technisch erforderliche Tracking- oder Attributionskennungen eingesetzt werden,
          sollte dies nur auf Basis einer wirksamen Einwilligung erfolgen. Vor dem Produktivgang ist
          daher zu pruefen, ob fuer diese Verarbeitungen ein passendes Consent-Management aktiv ist.
        </p>
      </LegalSection>

      <LegalSection title="5. Registrierung, Anmeldung und Authentifizierung">
        <p>
          Sie koennen <strong>perfectday24</strong> mit einem Nutzerkonto oder teilweise auch als Gast
          nutzen. Fuer Registrierung und Authentifizierung verwenden wir <strong>Supabase</strong>.
        </p>
        <p>Dabei koennen insbesondere folgende Daten verarbeitet werden:</p>
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
            "OAuth-Anmeldung ueber Google",
            "OAuth-Anmeldung ueber Microsoft",
          ]}
        />
        <p>
          Bei einer OAuth-Anmeldung koennen uns vom jeweiligen Anbieter zusaetzlich Profildaten
          uebermittelt werden, etwa Name, E-Mail-Adresse oder Avatar-URL, soweit Sie diese Freigabe
          gegenueber dem Anbieter erteilt haben.
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
          Nutzerkennung, um Gastfunktionen bereitzustellen und eine spaetere Uebernahme bestimmter
          Einstellungen oder Daten in ein regulaeres Konto zu ermoeglichen.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="7. Profil, Interessen und oeffentliche Creator-Profile">
        <p>Im Rahmen Ihres Profils koennen wir insbesondere folgende Daten verarbeiten:</p>
        <BulletList
          items={[
            "Anzeigename",
            "Benutzername",
            "Profilbild / Avatar",
            "Biografie",
            "Interessen und Vorlieben",
            "oeffentliche Creator-/Profilangaben",
            "verknuepfte Social-/Profilmetriken",
          ]}
        />
        <p>
          Wenn Sie ein oeffentlich sichtbares Profil oder eine oeffentliche Route anlegen, koennen
          bestimmte Angaben fuer andere Nutzerinnen und Nutzer oder fuer Besucher oeffentlicher Seiten
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
          Im Planner verarbeiten wir die Daten, die Sie fuer die Erstellung eines Plans eingeben oder
          auswaehlen. Dazu gehoeren insbesondere:
        </p>
        <BulletList
          items={[
            "gewaehlte Stadt und Land",
            "Datum, Anlass, Budget, Erlebnismodus und weitere Planner-Parameter",
            "Interessen und Gruppenpraeferenzen",
            "manueller Startpunkt mit Bezeichnung und Koordinaten",
            "optional der aktuelle Standort, wenn Sie die Standortfreigabe in Ihrem Browser erteilen",
            "Planvarianten, Stopps, Begruendungen und Zusammenfassungen",
          ]}
        />
        <p>
          Wenn Sie die Funktion \"aktueller Standort\" nutzen, wird Ihr Standort nur verarbeitet, wenn
          Sie dies ueber die Browser- bzw. Geraeteeinstellungen freigeben und die Funktion aktiv
          verwenden. Wir nutzen den Standort fuer die Ermittlung des geeigneten Ausgangspunkts Ihrer
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
          mit internen Orts- und Stadtdaten ab, um Vorschlaege fuer Adressen, Hotels, Bahnhoefe,
          Flughaefen oder andere Startpunkte anzuzeigen.
        </p>
        <p>Verarbeitet werden dabei insbesondere:</p>
        <BulletList
          items={[
            "Suchbegriff",
            "gewaehlter Ortstyp",
            "Stadtbezug",
            "Koordinaten und Bezeichnungen der Treffer",
          ]}
        />
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="10. Gespeicherte Plaene">
        <p>Wenn Sie einen Plan speichern, verarbeiten wir insbesondere:</p>
        <BulletList
          items={[
            "Titel des Plans",
            "Filter- und Planungseinstellungen",
            "effektiven Radius und Sortierung",
            "ausgewaehlte Stopps mit Bezeichnungen, Notizen, Dauer, Koordinaten und externen Links",
            "Gruppenbezug und Varianteninformationen",
            "eine gegebenenfalls erzeugte KI-Beschreibung des Plans",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt zur Speicherung und spaeteren Wiederverwendung Ihrer Planungen auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="11. Geteilte Plaene und Share-Links">
        <p>
          Sie koennen Plaene ueber einen individuellen Share-Link teilen. Dabei wird ein eindeutiger
          Share-Token erzeugt. Jeder, der ueber diesen Link verfuegt, kann den freigegebenen Plan
          aufrufen. Bitte teilen Sie solche Links daher nur mit Personen, fuer die der Plan bestimmt
          ist.
        </p>
        <p>Auf oeffentlichen Share-Seiten koennen insbesondere folgende Inhalte sichtbar sein:</p>
        <BulletList
          items={[
            "Titel und Inhalte des geteilten Plans",
            "Startpunktbezeichnung",
            "gespeicherte Stopps und Beschreibungen",
            "gegebenenfalls die KI-generierte Planbeschreibung",
            "gemeinschaftliche Wahl-/Abstimmungsinformationen",
            "Aenderungswuensche der Gruppe",
          ]}
        />
        <p>Andere Personen koennen auf Share-Seiten zudem:</p>
        <BulletList
          items={[
            "ihren Namen fuer Abstimmungen angeben",
            "Aenderungswuensche mit Namensangabe und Nachricht hinterlassen",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern die Teilung
          und Zusammenarbeit von Ihnen initiiert wurde.
        </p>
      </LegalSection>

      <LegalSection title="12. Gruppenfunktionen, Freundschaften, Follows und soziale Interaktion">
        <p>
          <strong>perfectday24</strong> enthaelt soziale und kollaborative Funktionen. Dabei koennen
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
          Plaenen. Systemnachrichten, die aus Gruppenaktionen entstehen, koennen ebenfalls gespeichert
          werden.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="14. Creator-Routen, Likes, Bookmarks und Bewertungen">
        <p>Wenn Sie Routen erstellen oder mit Routen interagieren, verarbeiten wir insbesondere:</p>
        <BulletList
          items={[
            "Routentitel, Beschreibungen, Stopps, Notizen und Koordinaten",
            "Sichtbarkeitseinstellungen",
            "Likes",
            "Bookmarks",
            "Bewertungen und optionale Bewertungstexte",
            "aggregierte Kennzahlen wie Like-, Bookmark- oder Bewertungsanzahl",
          ]}
        />
        <p>
          Bei oeffentlichen oder ungelisteten Routen koennen Inhalte fuer andere Nutzerinnen und
          Nutzer sichtbar sein.
        </p>
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
      </LegalSection>

      <LegalSection title="15. Karten, Routing und externe Kartendienste">
        <p>
          Bei Nutzung von Karten- und Routing-Funktionen werden technische Anfragen an externe
          Kartendienste bzw. Infrastruktur-Anbieter uebermittelt. Nach aktuellem Projektstand betrifft
          dies insbesondere:
        </p>
        <BulletList
          items={[
            "OpenStreetMap fuer Kartentiles",
            "OSRM (router.project-osrm.org) fuer Routenberechnungen",
            "ein CDN fuer Leaflet-Marker-Ressourcen",
          ]}
        />
        <p>
          Dabei wird insbesondere Ihre IP-Adresse sowie die fuer die Kartendarstellung bzw.
          Routenberechnung erforderliche Anfrage an den jeweiligen Anbieter uebermittelt. Wenn Sie
          Karten oder Routen nicht nutzen, findet diese Uebermittlung grundsaetzlich nicht statt.
        </p>
        <p>
          Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 6 Abs. 1
          lit. f DSGVO. Unser berechtigtes Interesse liegt in der funktionsfaehigen Darstellung von
          Karten und Wegen innerhalb des Produkts.
        </p>
      </LegalSection>

      <LegalSection title="16. Externe Links und Weiterleitungen, insbesondere Google Maps und Partnerlinks">
        <p>
          <strong>perfectday24</strong> kann externe Links zu Drittangeboten enthalten, etwa zu
          Reservierungsseiten, Ticketseiten, Partnerangeboten oder zu Google Maps. Wenn Sie einen
          solchen Link anklicken, verlassen Sie unser Angebot oder werden ueber eine von uns
          bereitgestellte Weiterleitungsstrecke zu dem externen Ziel weitergeleitet.
        </p>
        <p>Dabei koennen insbesondere verarbeitet werden:</p>
        <BulletList
          items={[
            "Ziel-URL",
            "pseudonyme Sitzungs- oder Attributionskennungen",
            "Bezugsdaten zum Plan, Ort, Event oder Partner",
            "Zeitpunkt des Klicks",
          ]}
        />
        <p>
          Die eigentliche weitere Verarbeitung auf der Zielseite erfolgt ausschliesslich durch den
          jeweiligen Drittanbieter.
        </p>
      </LegalSection>

      <LegalSection title="17. Affiliate-, Attributions- und Monetarisierungsfunktionen">
        <p>
          <strong>perfectday24</strong> enthaelt Funktionen zur Messung von Partnerinteraktionen,
          Affiliate-Klicks und anderen monetarisierungsnahen Ereignissen. Dabei koennen insbesondere
          folgende Daten verarbeitet werden:
        </p>
        <BulletList
          items={[
            "Nutzer-ID oder pseudonyme anonyme Kennung",
            "Sitzungskennung",
            "bezogene Plan-, Routen-, Event-, Orts- oder Partner-ID",
            "verwendete Flaeche innerhalb des Produkts",
            "Event-Typ, etwa Klick, Share-Aktivierung, Plan-Speicherung oder Conversion-nahe Handlung",
            "Zeitstempel",
            "technische Zusatzinformationen in Metadaten",
          ]}
        />
        <p>
          Diese Daten dienen dazu, Partnerinteraktionen nachzuvollziehen, Affiliate- oder
          Kampagnenlogiken technisch abzubilden, Missbrauch zu begrenzen sowie interne Produkt- und
          Erlosmodelle auszuwerten.
        </p>
        <p>
          Die Verarbeitung stuetzen wir grundsaetzlich auf Art. 6 Abs. 1 lit. f DSGVO. Soweit im
          Rahmen dieser Funktionen nicht technisch erforderliche Kennungen auf dem Endgeraet
          gespeichert oder ausgelesen werden, sollte dies nur nach vorheriger Einwilligung erfolgen.
        </p>
      </LegalSection>

      <LegalSection title="18. KI-gestuetzte Textgenerierung mit OpenAI">
        <p>
          Wenn Sie die Funktion zur KI-gestuetzten Generierung von Plantexten nutzen, uebermitteln wir
          die fuer die Textgenerierung erforderlichen Planungsdaten an <strong>OpenAI</strong>. Dazu
          koennen insbesondere gehoeren:
        </p>
        <BulletList
          items={[
            "Planparameter wie Budget, Anlass, Modus und Interessen",
            "ausgewaehlte Stopps und Slot-Informationen",
            "Bezeichnungen, Kategorien, Distanzen und sonstige planrelevante Angaben",
          ]}
        />
        <p>
          Die Nutzung der KI-Funktion erfolgt nur, wenn Sie diese aktiv anstossen. Bitte geben Sie in
          diesem Zusammenhang keine sensiblen oder sonst besonders schutzbeduerftigen Daten ein, sofern
          dies nicht zwingend erforderlich ist.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Soweit es bei der Nutzung des Dienstleisters
          zu Datenuebermittlungen in Drittlaender kommt, erfolgt dies vorbehaltlich geeigneter
          Garantien. Die konkrete vertragliche und organisatorische Ausgestaltung mit OpenAI ist vor
          Veroeffentlichung abschliessend zu pruefen und hier gegebenenfalls zu ergaenzen.
        </p>
      </LegalSection>

      <LegalSection title="19. Einsatz von Supabase">
        <p>
          Fuer Datenbank-, Authentifizierungs- und Speicherfunktionen nutzen wir
          <strong> Supabase</strong>. Ueber Supabase koennen insbesondere folgende
          Verarbeitungsvorgaenge erfolgen:
        </p>
        <BulletList
          items={[
            "Nutzer-Authentifizierung",
            "Speicherung von Profildaten",
            "Speicherung von Plaenen, Gruppen, Chat-Daten und Social-Daten",
            "Speicherung von Avataren und sonstigen Dateien",
          ]}
        />
        <p>
          Die Verarbeitung erfolgt zur technischen Bereitstellung unserer Plattform und damit auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p>
          Anbieter, Anschrift, Region und gegebenenfalls eingesetzte Unterauftragsverarbeiter sind vor
          Veroeffentlichung dieser Datenschutzerklaerung konkret zu ergaenzen:
        </p>
        <BulletList
          items={[
            "Anbieter: [bitte ergaenzen]",
            "Anschrift: [bitte ergaenzen]",
            "Region / Serverstandort: [bitte ergaenzen]",
          ]}
        />
      </LegalSection>

      <LegalSection title="20. Empfaenger von Daten">
        <p>Empfaenger Ihrer Daten koennen insbesondere sein:</p>
        <BulletList
          items={[
            "Hosting-Provider",
            "Supabase als Infrastruktur- und Datenbankdienstleister",
            "OpenAI bei Nutzung der KI-Textfunktion",
            "Anbieter externer Karten-, Routing- und Linkziele",
            "gegebenenfalls Partner- und Affiliate-Anbieter, soweit Sie entsprechende Links aktiv nutzen",
          ]}
        />
        <p>
          Wir uebermitteln personenbezogene Daten nur insoweit, wie dies fuer die jeweiligen Funktionen
          erforderlich ist oder eine rechtliche Verpflichtung besteht.
        </p>
      </LegalSection>

      <LegalSection title="21. Drittlanduebermittlungen">
        <p>
          Soweit wir Dienstleister oder Angebote einsetzen, bei denen eine Uebermittlung
          personenbezogener Daten in Staaten ausserhalb der Europaeischen Union bzw. des Europaeischen
          Wirtschaftsraums nicht ausgeschlossen werden kann, erfolgt eine solche Uebermittlung nur
          unter Beachtung der gesetzlichen Voraussetzungen.
        </p>
        <p>
          Dies kann insbesondere durch Angemessenheitsbeschluesse oder geeignete Garantien wie
          Standardvertragsklauseln erfolgen, soweit erforderlich. Die konkret eingesetzten
          Transfermechanismen sollten vor Livegang dokumentiert und hier ergaenzt werden.
        </p>
      </LegalSection>

      <LegalSection title="22. Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie dies fuer die jeweiligen Zwecke
          erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
        </p>
        <p>Nach aktuellem Produktstand gelten insbesondere folgende Grundsaetze:</p>
        <BulletList
          items={[
            "Kontodaten speichern wir fuer die Dauer des Bestehens Ihres Nutzerkontos.",
            "Profil-, Plan-, Routen-, Gruppen- und Chat-Daten speichern wir grundsaetzlich so lange, bis Sie Inhalte loeschen oder Ihr Konto entfernt wird, soweit keine gesetzlichen Pflichten entgegenstehen.",
            "Oeffentlich freigegebene Inhalte und Share-Daten bleiben sichtbar, solange die zugrunde liegenden Inhalte bzw. Freigaben bestehen.",
            "Lokale Browser-Speicherungen verbleiben grundsaetzlich auf Ihrem Endgeraet, bis Sie diese loeschen oder sie durch Ihren Browser entfernt werden.",
            "Attributions- und Monetarisierungsdaten sollten vor Veroeffentlichung mit konkreten Loesch- bzw. Prueffristen hinterlegt werden.",
          ]}
        />
        <p>Die finalen Fristen sind intern festzulegen und an dieser Stelle zu konkretisieren.</p>
      </LegalSection>

      <LegalSection title="23. Ihre Rechte">
        <p>Sie haben nach Massgabe der gesetzlichen Voraussetzungen insbesondere folgende Rechte:</p>
        <BulletList
          items={[
            "Recht auf Auskunft gemaess Art. 15 DSGVO",
            "Recht auf Berichtigung gemaess Art. 16 DSGVO",
            "Recht auf Loeschung gemaess Art. 17 DSGVO",
            "Recht auf Einschraenkung der Verarbeitung gemaess Art. 18 DSGVO",
            "Recht auf Datenuebertragbarkeit gemaess Art. 20 DSGVO",
            "Recht auf Widerspruch gemaess Art. 21 DSGVO",
            "Recht auf Widerruf einer erteilten Einwilligung mit Wirkung fuer die Zukunft",
          ]}
        />
        <p>
          Zur Ausuebung Ihrer Rechte koennen Sie uns jederzeit unter den oben genannten Kontaktdaten
          kontaktieren.
        </p>
      </LegalSection>

      <LegalSection title="24. Beschwerderecht bei einer Aufsichtsbehoerde">
        <p>
          Sie haben ausserdem das Recht, sich bei einer Datenschutzaufsichtsbehoerde ueber die
          Verarbeitung Ihrer personenbezogenen Daten durch uns zu beschweren.
        </p>
        <p>Zustaendige Aufsichtsbehoerde:</p>
        <p>[bitte zustaendige Landesdatenschutzbehoerde des Verantwortlichen ergaenzen]</p>
      </LegalSection>

      <LegalSection title="25. Pflicht zur Bereitstellung von Daten">
        <p>
          Die Bereitstellung personenbezogener Daten ist teilweise fuer die Nutzung einzelner
          Funktionen von <strong>perfectday24</strong> erforderlich. Ohne bestimmte Daten koennen wir
          insbesondere Konto-, Planer-, Gruppen-, Share- oder Chat-Funktionen unter Umstaenden nicht
          oder nur eingeschraenkt bereitstellen.
        </p>
        <p>
          Die Bereitstellung von Standortdaten, Profilangaben, oeffentlichen Inhalten oder
          KI-bezogenen Eingaben ist dagegen in der Regel freiwillig, kann jedoch fuer die jeweilige
          Funktion erforderlich sein, wenn Sie diese aktiv nutzen moechten.
        </p>
      </LegalSection>

      <LegalSection title="26. Aenderungen dieser Datenschutzerklaerung">
        <p>
          Wir behalten uns vor, diese Datenschutzerklaerung anzupassen, wenn dies aufgrund
          technischer, rechtlicher oder organisatorischer Aenderungen erforderlich wird. Es gilt die
          jeweils auf unserer Website veroeffentlichte Fassung.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
