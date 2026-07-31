import type { Metadata } from "next";
import { OCCASION_LABEL } from "@/lib/events/occasion-theme";
import { fetchCityName, fetchInvitePlan, formatInviteDate } from "@/lib/events/invite-og-data";

// Individuelle Link-Vorschau (WhatsApp, Mail, iMessage …) für die Einladung:
// Titel + Beschreibung aus den Eventdaten; das Vorschaubild liefert
// opengraph-image.tsx im selben Ordner. Token-Seiten sind privat → noindex.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const plan = await fetchInvitePlan(token);

  if (!plan) {
    return {
      title: "Einladung | PerfectDay24",
      robots: { index: false, follow: false },
    };
  }

  const occasionLabel = OCCASION_LABEL[plan.occasion_slug] ?? "Event";
  const cityName = await fetchCityName(plan.city_slug);
  const when = formatInviteDate(plan.event_date);

  const title = `Einladung: ${plan.title || occasionLabel}`;
  const description = [
    [when ? `Am ${when}` : null, cityName ? `in ${cityName}` : null].filter(Boolean).join(" "),
    plan.host_display_name
      ? `${plan.host_display_name} lädt dich herzlich ein.`
      : "Du bist herzlich eingeladen.",
    "Jetzt ansehen und direkt zusagen.",
  ]
    .filter((p) => p && p.length > 0)
    .join(" — ");

  return {
    title: `${title} | PerfectDay24`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "de_DE",
      siteName: "PerfectDay24",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
