type ImageAttributionData = {
  text: string;
  compactText: string;
  landingUrl: string | null;
  licenseUrl: string | null;
};

type ImageAttributionProps = {
  meta: unknown;
  className?: string;
  compact?: boolean;
  tone?: "light" | "dark";
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function cleanUrl(value: unknown) {
  const text = cleanText(value);
  return /^https?:\/\//i.test(text) ? text : null;
}

export function imageAttributionFromMeta(meta: unknown): ImageAttributionData | null {
  const imageAttribution = asObject(asObject(meta).image_attribution);
  if (Object.keys(imageAttribution).length === 0) return null;

  const attributionText = cleanText(imageAttribution.attribution_text);
  const title = cleanText(imageAttribution.title);
  const creator = cleanText(imageAttribution.creator);
  const license = cleanText(imageAttribution.license);
  const provider = cleanText(imageAttribution.provider_source) || cleanText(imageAttribution.provider);
  const compactText = [creator, license].filter(Boolean).join(" / ") || provider || title || attributionText;
  const fallbackText = [title, creator, license || provider].filter(Boolean).join(" - ");
  const text = attributionText || fallbackText || compactText;

  if (!text) return null;

  return {
    text,
    compactText: compactText || text,
    landingUrl: cleanUrl(imageAttribution.landing_url),
    licenseUrl: cleanUrl(imageAttribution.license_url),
  };
}

export default function ImageAttribution({
  meta,
  className = "",
  compact = false,
  tone = "light",
}: ImageAttributionProps) {
  const attribution = imageAttributionFromMeta(meta);
  if (!attribution) return null;

  const text = compact ? attribution.compactText : attribution.text;
  const textClass = tone === "dark" ? "text-white/85" : "text-gray-500";
  const linkClass =
    tone === "dark"
      ? "text-white underline underline-offset-2 hover:text-white/90"
      : "text-gray-600 underline underline-offset-2 hover:text-gray-900";

  const credit = attribution.landingUrl ? (
    <a href={attribution.landingUrl} target="_blank" rel="noreferrer" className={linkClass}>
      {text}
    </a>
  ) : (
    <span>{text}</span>
  );

  return (
    <div className={`text-[11px] leading-5 ${textClass} ${className}`}>
      <span>{compact ? "Bild: " : "Bildnachweis: "}</span>
      {credit}
      {attribution.licenseUrl ? (
        <>
          <span> · </span>
          <a href={attribution.licenseUrl} target="_blank" rel="noreferrer" className={linkClass}>
            Lizenz
          </a>
        </>
      ) : null}
    </div>
  );
}
