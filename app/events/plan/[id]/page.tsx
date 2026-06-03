"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Types ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

type ProviderPackage = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_unit: string;
  includes: string[];
};

type ServiceProvider = {
  id: string;
  name: string;
  service_type: string;
  is_verified: boolean;
};

type EventBooking = {
  id: string;
  need_slug: string;
  service_provider_id: string;
  provider_package_id: string | null;
  price_cents_agreed: number;
  service_providers: ServiceProvider | null;
  provider_packages: ProviderPackage | null;
};

type EventPlan = {
  id: string;
  title: string;
  occasion_slug: string;
  city_slug: string;
  event_date: string | null;
  guest_count: number | null;
  budget_cents: number | null;
  status: string;
  selected_needs: string[];
  share_token: string | null;
  host_display_name: string | null;
  invite_note: string | null;
  created_at: string;
  event_bookings: EventBooking[];
};

type RsvpRow = {
  id: string;
  guest_name: string;
  response: "accepted" | "declined";
  message: string | null;
  created_at: string;
};

type VendorQuote = {
  id: string;
  need_slug: string | null;
  status: string;
  price_cents: number | null;
  price_unit: string;
  availability_confirmed: boolean | null;
  vendor_message: string | null;
  expires_at: string;
  service_providers: { id: string; name: string; service_type: string } | null;
};

type EventInquiry = {
  id: string;
  status: string;
  sent_at: string | null;
  vendor_quotes: VendorQuote[];
};

type EventDetailTab = "overview" | "offers" | "bookings" | "agenda";

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Constants ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

const NEED_LABEL: Record<string, string> = {
  location: "Location",
  catering: "Catering",
  musik: "Musik / DJ",
  deko: "Dekoration",
  florist: "Florist",
  fotografie: "Fotografie",
  video: "Videografie",
  moderation: "Moderation",
  animation: "Animation / Aktivität",
  torte: "Torte",
  technik: "Technik / AV",
  transport: "Transport",
};

const OCCASION_LABEL: Record<string, string> = {
  geburtstag: "Geburtstag",
  hochzeit: "Hochzeit",
  teambuilding: "Teambuilding",
  firmenfeier: "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz: "Konferenz",
  jubilaeum: "Jubiläum",
  staedtereise: "Städtereise",
};

const CITY_LABEL: Record<string, string> = {
  "berlin-berlin": "Berlin",
  hamburg: "Hamburg",
  muenchen: "München",
  wien: "Wien",
  zuerich: "Zürich",
  koeln: "Köln",
  "frankfurt-am-main": "Frankfurt",
  stuttgart: "Stuttgart",
  duesseldorf: "Düsseldorf",
  leipzig: "Leipzig",
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  location: "Location",
  catering: "Catering",
  dj: "DJ",
  band: "Band",
  entertainment: "Entertainment",
  decoration: "Dekoration",
  florist: "Florist",
  photography: "Fotografie",
  video: "Video",
  moderator: "Moderation",
  animation: "Animation",
  cake: "Torte",
  technology: "Technik / AV",
  transport: "Transport",
};

function formatPrice(totalCents: number, pkgPriceCents: number, unit: string): string {
  const total = totalCents / 100;
  if (unit === "per_person") {
    const perPerson = pkgPriceCents / 100;
    return `${perPerson.toLocaleString("de-DE")} € pro Person · ${total.toLocaleString("de-DE")} € gesamt`;
  }
  return `${total.toLocaleString("de-DE")} €`;
}


function effectiveTotal(cents: number): number {
  return cents / 100;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Page ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

export default function EventPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [inquiries, setInquiries] = useState<EventInquiry[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showShareConfig, setShowShareConfig] = useState(false);
  const [hostName, setHostName] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [activeTab, setActiveTab] = useState<EventDetailTab>("overview");
  const [quoteToConfirm, setQuoteToConfirm] = useState<VendorQuote | null>(null);

  const loadPlan = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    if (!userId) {
      router.replace(`/profile?return=${encodeURIComponent(`/events/plan/${id}`)}`);
      return;
    }

    const { data, error } = await supabase
      .from("event_plans")
      .select(`
        id, title, occasion_slug, city_slug, event_date, guest_count,
        budget_cents, status, selected_needs, share_token, created_at,
        event_bookings (
          id, need_slug, service_provider_id, provider_package_id,
          price_cents_agreed,
          service_providers ( id, name, service_type, is_verified ),
          provider_packages ( id, name, description, price_cents, price_unit, includes )
        )
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPlan(data as unknown as EventPlan);

    // Load inquiries for this plan
    const { data: inqData } = await supabase
      .from("event_inquiries")
      .select(`
        id, status, sent_at,
        vendor_quotes (
          id, need_slug, status, price_cents, price_unit,
          availability_confirmed, vendor_message, expires_at,
          service_providers ( id, name, service_type )
        )
      `)
      .eq("event_plan_id", id)
      .order("created_at", { ascending: false });

    if (inqData) setInquiries(inqData as unknown as EventInquiry[]);

    // Load RSVPs for this plan
    const { data: rsvpData } = await supabase.rpc("get_plan_rsvps", { p_plan_id: id });
    if (rsvpData) setRsvps(rsvpData as RsvpRow[]);

    setLoading(false);
  }, [id, router]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);

  async function handleShare() {
    if (!plan) return;
    setShareLoading(true);

    // Save host name / invite note if changed
    const updates: Record<string, string> = {};
    if (hostName.trim()) updates.host_display_name = hostName.trim();
    if (inviteNote.trim()) updates.invite_note = inviteNote.trim();

    if (plan.share_token) {
      if (Object.keys(updates).length) {
        await supabase.from("event_plans").update(updates).eq("id", plan.id);
      }
      const url = `${window.location.origin}/events/agenda/${plan.share_token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareCopied(true);
      setShowShareConfig(false);
      setShareLoading(false);
      return;
    }

    const token = crypto.randomUUID().replace(/-/g, "").substring(0, 24);
    const { error } = await supabase
      .from("event_plans")
      .update({ share_token: token, ...updates })
      .eq("id", plan.id);

    if (error) { setShareLoading(false); return; }

    const url = `${window.location.origin}/events/agenda/${token}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setShowShareConfig(false);
    setPlan((prev) => prev ? { ...prev, share_token: token } : prev);
    setShareLoading(false);
  }

  function toggleBooking(bookingId: string) {
    setExpandedBookings((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  }

  async function bookVendor(quote: VendorQuote) {
    if (!plan) return;
    setBookingLoading(quote.id);
    setBookingError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;
      if (!userId) { setBookingError("Bitte zuerst anmelden."); return; }

      const response = await fetch("/api/events/book-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          quoteId: quote.id,
        }),
      });

      if (!response.ok) {
        setBookingError("Buchung konnte nicht gespeichert werden.");
        return;
      }

      await loadPlan();
    } finally {
      setBookingLoading(null);
    }
  }

  async function confirmBookedVendor() {
    if (!quoteToConfirm) return;
    const quote = quoteToConfirm;
    setQuoteToConfirm(null);
    await bookVendor(quote);
  }

  // ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Return URL (persisted via sessionStorage across the events flow) ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("pd24_event_return");
    if (stored) {
      setReturnUrl(stored);
      sessionStorage.removeItem("pd24_event_return"); // consume once
    }
  }, []);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "offers" || requested === "bookings" || requested === "agenda" || requested === "overview") {
      setActiveTab(requested);
      return;
    }
    setActiveTab("overview");
  }, [searchParams]);

  // ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Derived ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

  const guests = plan?.guest_count ?? 1;
  const bookings = plan?.event_bookings ?? [];
  const allQuotes = inquiries.flatMap((inq) => inq.vendor_quotes ?? []);
  const respondedQuotes = allQuotes.filter((q) => q.status === "quoted" || q.status === "accepted");
  const pendingQuotes = allQuotes.filter((q) => q.status === "pending" || q.status === "viewed");
  const bookedNeeds = new Set((plan?.event_bookings ?? []).map((b) => b.need_slug));
  const quotesByNeed = allQuotes.reduce<Record<string, VendorQuote[]>>((acc, quote) => {
    const key = quote.need_slug ?? "sonstige";
    if (!acc[key]) acc[key] = [];
    acc[key].push(quote);
    return acc;
  }, {});
  const respondedTotal = respondedQuotes.length;
  const pendingTotal = pendingQuotes.length;
  const byNeed = quotesByNeed;
  const runningTotal = bookings.reduce(
    (sum, b) => sum + effectiveTotal(b.price_cents_agreed),
    0
  );
  const budget = plan ? (plan.budget_cents ?? 0) / 100 : 0;
  const overBudget = budget > 0 && runningTotal > budget;
  const createdFromFlow = searchParams.get("created") === "1";
  const createdInquiryCount = Number(searchParams.get("inquiries") ?? "0");
  const createdBookingCount = Number(searchParams.get("bookings") ?? "0");
  const inquiryFailed = searchParams.get("inquiryError") === "1";

  const editParams = plan
    ? new URLSearchParams({
        occasion: plan.occasion_slug,
        city: plan.city_slug,
        ...(plan.event_date ? { date: plan.event_date } : {}),
        ...(plan.guest_count ? { guests: String(plan.guest_count) } : {}),
        ...(plan.budget_cents ? { budget: String(Math.round(plan.budget_cents / 100)) } : {}),
        needs: (plan.selected_needs ?? []).join(","),
      }).toString()
    : "";

  // ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Render states ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-medium text-[var(--text-strong)]">Plan nicht gefunden</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Der Plan existiert nicht oder gehört zu einem anderen Account.</p>
        <Link
          href="/events"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          Zurück zu den Events
        </Link>
      </div>
    );
  }

  // ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Main render ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢â‚¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬


  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/events"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
        >
          Zurück zu Events
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
              {plan.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                {OCCASION_LABEL[plan.occasion_slug] ?? plan.occasion_slug}
              </span>
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                {CITY_LABEL[plan.city_slug] ?? plan.city_slug}
              </span>
              {plan.event_date && (
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  {formatDate(plan.event_date)}
                </span>
              )}
              {plan.guest_count && (
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  {plan.guest_count} Gäste
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Link
              href={`/events/plan/new?${editParams}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-surface)]"
            >
              Bearbeiten
            </Link>
            <button
              onClick={() => setShowShareConfig((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              Einladung teilen
            </button>
          </div>
        </div>

        {showShareConfig && (
          <div className="mt-4 space-y-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text-strong)]">Einladung anpassen</p>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Wer lädt ein? Zum Beispiel Anna & Thomas oder die Marketingabteilung.
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder={plan?.host_display_name ?? "Name des Gastgebers"}
                className="w-full rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Persönliche Nachricht an die Gäste (optional)
              </label>
              <textarea
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                rows={3}
                placeholder={plan?.invite_note ?? "Kommt gerne in festlicher Kleidung ..."}
                className="w-full resize-none rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleShare()}
                disabled={shareLoading}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {shareLoading ? "Wird erstellt ..." : shareCopied ? "Link kopiert" : "Einladungslink erstellen und kopieren"}
              </button>
              <button
                onClick={() => setShowShareConfig(false)}
                className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {shareUrl && !showShareConfig && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-muted)]">{shareUrl}</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl).catch(() => {});
                setShareCopied(true);
              }}
              className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--text-strong)] hover:text-white"
            >
              {shareCopied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
        )}
      </div>

      {/* Return CTA */}
      {returnUrl && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm text-blue-900">
            Event angelegt. Jetzt Teilnehmer einladen und RSVPs verfolgen.
          </p>
          <Link
            href={`${returnUrl}?event=${plan.id}`}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Weiter zur Teilnehmerverwaltung →
          </Link>
        </div>
      )}

      {(createdFromFlow || inquiryFailed) && (
        <div className={`mb-6 rounded-2xl px-5 py-4 ${inquiryFailed ? "border border-amber-200 bg-amber-50" : "border border-emerald-200 bg-emerald-50"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {inquiryFailed ? (
                <>
                  <p className="text-sm font-semibold text-amber-900">
                    Dein Event wurde gespeichert, aber Preisanfragen konnten nicht vollständig versendet werden.
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Bitte Anbieter erneut anfragen. Erst erfolgreiche Anfragen erscheinen im Bereich Anfragen & Angebote.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-emerald-900">
                    {createdInquiryCount > 0 && createdBookingCount > 0
                      ? "Anfragen und Leistungen wurden gespeichert."
                      : createdInquiryCount > 0
                        ? createdInquiryCount === 1
                          ? "Anfrage wurde gespeichert."
                          : "Anfragen wurden gespeichert."
                        : createdBookingCount > 0
                          ? createdBookingCount === 1
                            ? "Leistung wurde gespeichert."
                            : "Leistungen wurden gespeichert."
                          : "Dein Event wurde gespeichert."}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    {createdInquiryCount > 0
                      ? createdInquiryCount === 1
                        ? "1 Anfrage wurde versendet. Angebote laufen jetzt im Bereich Anfragen & Angebote ein."
                        : `${createdInquiryCount} Anfragen wurden versendet. Angebote laufen jetzt im Bereich Anfragen & Angebote ein.`
                      : "Dein Event ist gespeichert und bereit für die nächsten Schritte."}
                    {createdBookingCount > 0 ? ` ${createdBookingCount} Leistung${createdBookingCount > 1 ? "en" : ""} ist bereits hinterlegt.` : ""}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(createdInquiryCount > 0 ? "offers" : "overview")}
              className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-white transition ${inquiryFailed ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-700 hover:bg-emerald-800"}`}
            >
              {createdInquiryCount > 0 && !inquiryFailed ? "Zu Anfragen & Angeboten" : "Zur Übersicht"}
            </button>
          </div>
        </div>
      )}

      {/* Budget summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
          <p className="text-xs text-[var(--text-muted)]">Gebuchte Leistungen</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{bookings.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
          <p className="text-xs text-[var(--text-muted)]">Gesamtkosten</p>
          <p className={`mt-1 text-2xl font-semibold ${overBudget ? "text-red-600" : "text-[var(--text-strong)]"}`}>
            {runningTotal.toLocaleString("de-DE")} €
          </p>
        </div>
        {budget > 0 && (
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
            <p className="text-xs text-[var(--text-muted)]">Budget</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">
              {budget.toLocaleString("de-DE")} €
            </p>
            {overBudget && (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                +{(runningTotal - budget).toLocaleString("de-DE")} € über Budget
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[  
          { id: "overview", label: "Übersicht" },
          { id: "offers", label: "Anfragen & Angebote" },
          { id: "bookings", label: "Gebuchte Leistungen" },
          { id: "agenda", label: "Agenda" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as EventDetailTab)}
              className={[
                "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                  : "border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Nächster Schritt</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
              {allQuotes.length > 0 ? "Anfragen verfolgen und Anbieter vergleichen" : "Leistungen buchen und Event finalisieren"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {allQuotes.length > 0
                ? "Hier sehen Sie gesammelt, welche Anbieter bereits geantwortet haben, wie hoch die Preise sind und wen Sie direkt buchen können."
                : "Sobald Angebote vorliegen oder Leistungen hinterlegt sind, sehen Sie hier den aktuellen Stand für Budget, Buchungen und offene Punkte."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("offers")}
                className="inline-flex min-h-10 items-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90"
              >
                Anfragen & Angebote öffnen
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bookings")}
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--line-subtle)] bg-white px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
              >
                Gebuchte Leistungen ansehen
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Angebotsstatus</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Angefragt</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{allQuotes.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Angebote erhalten</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">{respondedQuotes.length}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Ausstehend</p>
                <p className="mt-1 text-2xl font-semibold text-amber-800">{pendingQuotes.length}</p>
              </div>
              <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Leistungen gebucht</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{bookings.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "bookings" && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-[var(--text-strong)]">Gebuchte Leistungen</h2>

          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">Noch keine Leistungen gebucht.</p>
              <Link
                href={`/events/plan/new?${editParams}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                Anbieter auswählen
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(plan.selected_needs ?? []).map((need) => {
                const booking = bookings.find((b) => b.need_slug === need);
                if (!booking) return null;

                const provider = booking.service_providers;
                const pkg = booking.provider_packages;
                const expanded = expandedBookings[booking.id] ?? false;
                const priceUnit = booking.provider_packages?.price_unit ?? "flat";
                const itemTotal = effectiveTotal(booking.price_cents_agreed);

                return (
                  <div
                    key={booking.id}
                    className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-sm"
                  >
                    <button
                      onClick={() => toggleBooking(booking.id)}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[var(--bg-surface)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                            {NEED_LABEL[need] ?? need}
                          </span>
                          {provider?.is_verified && (
                            <span className="rounded-full bg-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Verifiziert
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-medium text-[var(--text-strong)]">
                          {provider?.name ?? "-"}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {pkg?.name ?? "-"}
                          {provider?.service_type && (
                            <span className="ml-2 text-xs">
                              · {SERVICE_TYPE_LABEL[provider.service_type] ?? provider.service_type}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-[var(--text-strong)]">
                          {itemTotal.toLocaleString("de-DE")} €
                        </p>
                        {priceUnit === "per_person" && pkg && (
                          <p className="text-xs text-[var(--text-muted)]">
                            {(pkg.price_cents / 100).toLocaleString("de-DE")} € pro Person
                          </p>
                        )}
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{expanded ? "▲" : "▼"}</p>
                      </div>
                    </button>

                    {expanded && pkg && (
                      <div className="border-t border-[var(--line-subtle)] px-5 py-4">
                        {pkg.description && (
                          <p className="mb-3 text-sm text-[var(--text-muted)]">{pkg.description}</p>
                        )}
                        {pkg.includes && pkg.includes.length > 0 && (
                          <ul className="space-y-1.5">
                            {pkg.includes.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                                <span className="mt-0.5 shrink-0 text-[var(--brand-accent)]">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-3 text-xs text-[var(--text-muted)]">
                          Preis:{" "}
                          {pkg ? formatPrice(booking.price_cents_agreed, pkg.price_cents, priceUnit) : "-"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "offers" && (() => {
        if (inquiries.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">Noch keine Anfragen versendet.</p>
              <Link
                href={`/events/plan/new?${editParams}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                Anbieter anfragen
              </Link>
            </div>
          );
        }

        return (
          <div>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
                <p className="text-xs text-[var(--text-muted)]">Anfragen gesendet</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{allQuotes.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-xs text-emerald-700">Angebote erhalten</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">{respondedQuotes.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-xs text-amber-700">Ausstehende Antworten</p>
                <p className="mt-1 text-2xl font-semibold text-amber-800">{pendingQuotes.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
                <p className="text-xs text-[var(--text-muted)]">Bereits gebucht</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{bookings.length}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-strong)]">Anfragen & Angebote</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {[
                      respondedQuotes.length > 0
                        ? `${respondedQuotes.length} Rückmeldung${respondedQuotes.length > 1 ? "en" : ""} erhalten`
                        : null,
                      bookings.length > 0
                        ? `${bookings.length} gebucht`
                        : null,
                      pendingTotal > 0
                        ? `${pendingTotal} ausstehend`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              {bookingError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {bookingError}
                </div>
              )}

              <div className="space-y-5">
                {Object.entries(byNeed).map(([needSlug, quotes]) => {
                  const needLabel = NEED_LABEL[needSlug] ?? needSlug;
                  const isBooked = bookedNeeds.has(needSlug);
                  const bookedBy = isBooked
                    ? (plan?.event_bookings ?? []).find((b) => b.need_slug === needSlug)
                    : null;

                  const sorted = [...quotes].sort((a, b) => {
                    const aRes = a.status === "quoted" || a.status === "accepted" ? 0 : 1;
                    const bRes = b.status === "quoted" || b.status === "accepted" ? 0 : 1;
                    if (aRes !== bRes) return aRes - bRes;
                    return (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity);
                  });

                  const receivedCount = quotes.filter((q) => q.status === "quoted" || q.status === "accepted").length;
                  const priceCandidates = quotes.filter((q) => q.price_cents != null).map((q) => q.price_cents ?? Infinity);
                  const minPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : Infinity;

                  return (
                    <div key={needSlug} className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white shadow-sm overflow-hidden">
                      <div className={`flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-5 py-3 ${isBooked ? "bg-emerald-50" : "bg-[var(--bg-surface)]"}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--text-strong)]">{needLabel}</span>
                          <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                            {quotes.length} Anfrage{quotes.length > 1 ? "n" : ""}
                          </span>
                          {receivedCount > 0 && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              {receivedCount} Angebot{receivedCount > 1 ? "e" : ""}
                            </span>
                          )}
                        </div>
                        {isBooked ? (
                          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Gebucht: {(bookedBy?.service_providers as { name?: string } | null)?.name ?? "-"}
                          </span>
                        ) : receivedCount > 0 && minPrice !== Infinity ? (
                          <span className="text-xs text-[var(--text-muted)]">
                            ab <strong className="text-[var(--text-strong)]">{(minPrice / 100).toLocaleString("de-DE")} €</strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="divide-y divide-[var(--line-subtle)]">
                        {sorted.map((q) => {
                          const provider = q.service_providers;
                          const isResponded = q.status === "quoted" || q.status === "accepted";
                          const isAccepted = q.status === "accepted";
                          const isExpired = q.status === "expired" || new Date(q.expires_at) < new Date();
                          const isAvailable = q.availability_confirmed === true;
                          const isUnavailable = q.availability_confirmed === false;
                          const isBestPrice = isResponded && q.price_cents === minPrice && receivedCount > 1;
                          const isLoading = bookingLoading === q.id;

                          return (
                            <div key={q.id} className={`flex items-start gap-4 px-5 py-4 ${isAccepted ? "bg-emerald-50/50" : ""}`}>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-[var(--text-strong)]">{provider?.name ?? "-"}</span>
                                  {isBestPrice && (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      Günstigstes Angebot
                                    </span>
                                  )}
                                  {isAccepted && (
                                    <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      Gebucht
                                    </span>
                                  )}
                                  {isResponded && !isAccepted && (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                                      Angebot eingegangen
                                    </span>
                                  )}
                                  {!isResponded && !isExpired && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
                                      Ausstehend
                                    </span>
                                  )}
                                  {isExpired && (
                                    <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                                      Abgelaufen
                                    </span>
                                  )}
                                </div>

                                {isResponded && q.price_cents != null && (
                                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                                    <span className="text-lg font-semibold text-[var(--text-strong)]">
                                      {(q.price_cents / 100).toLocaleString("de-DE")} €
                                      <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">
                                        {q.price_unit === "per_person" && "/ Person"}
                                        {q.price_unit === "per_hour" && "/ Stunde"}
                                        {q.price_unit === "total" && "gesamt"}
                                      </span>
                                    </span>
                                    {isAvailable && !isAccepted && (
                                      <span className="text-xs font-medium text-emerald-600">Verfügbar · buchbar</span>
                                    )}
                                    {isAvailable && isAccepted && (
                                      <span className="text-xs font-medium text-emerald-700">Verfügbar · gebucht</span>
                                    )}
                                    {isUnavailable && <span className="text-xs text-red-500">Nicht verfügbar</span>}
                                  </div>
                                )}
                                {isResponded && q.price_cents == null && (
                                  <p className="mt-1 text-sm text-[var(--text-muted)]">Preis auf Anfrage</p>
                                )}
                                {!isResponded && !isExpired && (
                                  <p className="mt-1 text-xs text-[var(--text-muted)]">Anbieter wurde benachrichtigt. Das Angebot steht noch aus.</p>
                                )}

                                {isResponded && q.vendor_message && (
                                  <p className="mt-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
                                    &quot;{q.vendor_message}&quot;
                                  </p>
                                )}
                              </div>

                              {isResponded && isAvailable && !isBooked && !isAccepted && (
                                <button
                                  type="button"
                                  onClick={() => setQuoteToConfirm(q)}
                                  disabled={isLoading}
                                  className="shrink-0 rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                                >
                                  {isLoading ? "Wird gebucht ..." : "Buchen"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === "agenda" && rsvps.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Rückmeldungen</h2>
            <div className="flex gap-3 text-xs text-[var(--text-muted)]">
              <span className="text-emerald-700 font-medium">
                {rsvps.filter((r) => r.response === "accepted").length} Zusagen
              </span>
              <span>
                {rsvps.filter((r) => r.response === "declined").length} Absagen
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {rsvps.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 shadow-sm"
              >
                <span className="mt-0.5 text-lg leading-none">
                  {r.response === "accepted" ? "🎉" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--text-strong)] text-sm">{r.guest_name}</p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.response === "accepted"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[var(--bg-surface)] text-[var(--text-muted)]",
                      ].join(" ")}
                    >
                      {r.response === "accepted" ? "Zugesagt" : "Abgesagt"}
                    </span>
                  </div>
                  {r.message && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">"{r.message}"</p>
                  )}
                </div>
                <p className="shrink-0 text-[10px] text-[var(--text-muted)]">
                  {new Date(r.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "agenda" && plan.selected_needs && plan.selected_needs.some((n) => !bookings.find((b) => b.need_slug === n)) && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-muted)]">Noch nicht vergeben</h3>
          <div className="flex flex-wrap gap-2">
            {plan.selected_needs
              .filter((n) => !bookings.find((b) => b.need_slug === n))
              .map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-dashed border-[var(--line-subtle)] px-3 py-1 text-xs text-[var(--text-muted)]"
                >
                  {NEED_LABEL[n] ?? n}
                </span>
              ))}
          </div>
          <Link
            href={`/events/plan/new?${editParams}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-surface)]"
          >
            Anbieter ergänzen →
          </Link>
        </div>
      )}

      {quoteToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-[var(--line-subtle)] bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Anbieter buchen</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
              {quoteToConfirm.service_providers?.name ?? "Anbieter"} buchen?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Diese Leistung wird als gebucht im Event hinterlegt und das Angebot als angenommen markiert.
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Leistung</span>
                <span className="font-medium text-[var(--text-strong)]">
                  {NEED_LABEL[quoteToConfirm.need_slug ?? ""] ?? quoteToConfirm.need_slug ?? "Angebot"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Preis</span>
                <span className="font-medium text-[var(--text-strong)]">
                  {quoteToConfirm.price_cents != null ? `${(quoteToConfirm.price_cents / 100).toLocaleString("de-DE")} €` : "Preis auf Anfrage"}
                </span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteToConfirm(null)}
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--line-subtle)] bg-white px-4 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void confirmBookedVendor()}
                disabled={bookingLoading === quoteToConfirm.id}
                className="inline-flex min-h-10 items-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                  {bookingLoading === quoteToConfirm.id ? "Wird gebucht ..." : "Jetzt buchen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 border-t border-[var(--line-subtle)] pt-6 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Erstellt am {formatDate(plan.created_at)} · Plan-ID: {plan.id.substring(0, 8)}
        </p>
      </div>

    </div>
  );
}



