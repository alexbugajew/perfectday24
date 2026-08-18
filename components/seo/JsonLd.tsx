// components/seo/JsonLd.tsx
//
// Gibt strukturierte Daten als <script type="application/ld+json"> aus.
//
// Die Komponente ist bewusst KEINE Client-Komponente: Das Skript muss im
// ausgelieferten HTML stehen, sonst sehen es genau die Crawler nicht, für die
// es gedacht ist.

import type { JsonLdObject } from "@/lib/seo/json-ld";

/**
 * Escapt "<", damit ein "</script>" in einem Routentitel oder einer
 * Stopp-Beschreibung das Tag nicht vorzeitig schließt — der Rest der Seite
 * würde sonst als Skript interpretierbar (XSS). Die Daten stammen zwar aus der
 * eigenen Datenbank, aber Routentitel und Stopp-Notizen sind
 * nutzergenerierte Inhalte.
 *
 * Weitere Escapes sind nicht nötig: Innerhalb von type="application/ld+json"
 * wird der Inhalt nicht als JavaScript geparst.
 */
function serialize(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function JsonLd({
  data,
}: {
  data: (JsonLdObject | undefined)[] | JsonLdObject | undefined;
}) {
  const blocks = (Array.isArray(data) ? data : [data]).filter(
    (entry): entry is JsonLdObject => Boolean(entry)
  );
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialize(block) }}
        />
      ))}
    </>
  );
}
