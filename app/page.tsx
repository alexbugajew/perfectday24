import HomepageScaffoldMinimal from "@/components/home/HomepageScaffoldMinimal";

// Täglich neu bauen: die Reichweiten-Stats kommen aus lib/reach-stats.
export const revalidate = 86400;

export default function HomePage() {
  return <HomepageScaffoldMinimal />;
}
