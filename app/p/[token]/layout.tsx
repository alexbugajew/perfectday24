import type { Metadata } from "next";
import { fetchCityName } from "@/lib/events/invite-og-data";
import { fetchSharedPlan } from "@/lib/og/shared-plan-data";

// Individuelle Link-Vorschau für geteilte Tagespläne: Titel, Stops und Stadt
// aus dem Plan; das Vorschaubild liefert opengraph-image.tsx. Token-Links
// bleiben privat → noindex.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const plan = await fetchSharedPlan(token);

  if (!plan) {
    return {
      title: "Geteilter Plan | PerfectDay24",
      robots: { index: false, follow: false },
    };
  }

  const cityName = await fetchCityName(plan.filters?.citySlug ?? null);
  const stopCount = Array.isArray(plan.slots) ? plan.slots.length : 0;
  const title = plan.title || (cityName ? `Ein Tag in ${cityName}` : "Dein Tagesplan");
  const description =
    plan.ai_description?.slice(0, 160) ??
    [
      stopCount > 0 ? `${stopCount} Stops` : null,
      cityName ? `in ${cityName}` : null,
      "— Ablauf, Timing und Route auf einen Blick. Ansehen, abstimmen und in den eigenen Planner übernehmen.",
    ]
      .filter(Boolean)
      .join(" ");

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

export default function SharedPlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
