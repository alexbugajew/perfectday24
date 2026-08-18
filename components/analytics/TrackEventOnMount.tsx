"use client";

// Meldet ein Funnel-Ereignis einmalig beim Einhängen — für Server-Komponenten,
// die selbst kein `useEffect` haben (geteilte Pläne, Einladungsseiten).

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName, AnalyticsEventProps } from "@/lib/analytics/events";

type Props<E extends AnalyticsEventName> = {
  event: E;
  props?: AnalyticsEventProps[E];
};

export default function TrackEventOnMount<E extends AnalyticsEventName>({
  event,
  props,
}: Props<E>) {
  // React 18/19 hängt Effekte im Strict Mode doppelt ein — ohne die Sperre
  // würde jeder Seitenaufruf in der Entwicklung doppelt gezählt.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
