"use client";

import dynamic from "next/dynamic";
import type { RouteSummary } from "@/components/PlanMap";

const PlanMap = dynamic(() => import("@/components/PlanMap").then((m) => m.default), {
  ssr: false,
});

type MapStop = {
  label: string;
  name: string;
  lat: number;
  lng: number;
};

type PlanMapClientProps = {
  stops: MapStop[];
  profile?: "foot" | "public_transit" | "car";
  height?: number;
  onSummary?: (summary: RouteSummary | null) => void;
};

export default function PlanMapClient({
  stops,
  profile = "foot",
  height = 360,
  onSummary,
}: PlanMapClientProps) {
  return <PlanMap stops={stops} profile={profile} height={height} onSummary={onSummary} />;
}
