"use client";

import dynamic from "next/dynamic";
import type { RouteMiniMapStop } from "@/components/RouteMiniMap";

const RouteMiniMap = dynamic(() => import("@/components/RouteMiniMap").then((m) => m.default), {
  ssr: false,
});

export default function RouteMiniMapClient({
  stops,
  height = 120,
}: {
  stops: RouteMiniMapStop[];
  height?: number;
}) {
  return <RouteMiniMap stops={stops} height={height} />;
}
