"use client";

import { useEffect } from "react";
import {
  trackMonetizationEvent,
  type ClientMonetizationTrackInput,
} from "@/lib/monetization/client";

export default function TrackOnMount(props: ClientMonetizationTrackInput) {
  useEffect(() => {
    void trackMonetizationEvent(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
