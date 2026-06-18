"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import EntityMediaGallery from "@/components/media/EntityMediaGallery";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerProfile = {
  id: string;
  display_name: string;
  partner_type: string;
  partner_type_slug: string;
  visibility_tier: string;
  billing_status: string;
  status: string;
  website_url: string | null;
  booking_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  primary_city_slug: string | null;
  notes: string | null;
  // Extended self-service columns
  service_category_slugs: string[];
  operating_cities: string[];
  media_urls: string[];
  type_data: Record<string, string>;
  booking_type: string;
  review_status: ReviewStatus;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
};

type ServiceProvider = {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  is_verified: boolean;
  status: string;
  review_status: ReviewStatus;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  provider_packages: ProviderPackage[];
};

type ProviderPackage = {
  id: string;
  name: string;
  price_cents: number;
  price_unit: string;
  status: string;
};

// ── Self-service provider form types ──────────────────────────────────────────

type NewProviderForm = {
  name: string;
  service_type: string;
  city_slug: string;
  description: string;
};

type NewPackageForm = {
  name: string;
  price: string;           // user inputs euros (decimal)
  price_unit: string;      // "total" | "per_person" | "per_hour"
  description: string;
  includes: string;        // newline-separated → split to array on submit
  min_guests: string;
  max_guests: string;
};

type NewCampaignForm = {
  name: string;
  campaign_type: string;
  city_slug: string;
  starts_at: string;
  ends_at: string;
  cta_label: string;
  cta_url: string;
  target_kind: "route" | "location" | "event";
  target_id: string;
};

type NewAffiliateLinkForm = {
  provider_name: string;
  destination_url: string;
  commission_model: string;
  link_scope: string;
  target_kind: "route" | "location" | "planner_event" | "none";
  target_id: string;
};

type AssetBuilderType = "location" | "event" | "route" | "affiliate";
type ReviewStatus = "draft" | "submitted" | "in_review" | "changes_requested" | "approved" | "published";
type ReviewEntity = "profile" | "provider" | "campaign" | "affiliate";

type BookingRequest = {
  id: string;
  need_slug: string;
  price_cents_agreed: number;
  status: string;
  created_at: string;
  service_providers: { id: string; name: string } | null;
  provider_packages: { id: string; name: string; price_cents: number; price_unit: string } | null;
  event_plans: {
    id: string;
    title: string;
    occasion_slug: string;
    guest_count: number | null;
    event_date: string | null;
  } | null;
};

type Stats = {
  impressions: number;
  clicks: number;
  bookings: number;
};

type PartnerCampaign = {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  review_status: ReviewStatus;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  city_slug: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cta_label: string | null;
  target_route_id: string | null;
  target_location_id: string | null;
  target_event_id: string | null;
};

type AffiliateLink = {
  id: string;
  link_scope: string;
  provider_name: string;
  commission_model: string;
  destination_url: string;
  is_active: boolean;
  review_status: ReviewStatus;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  route_id: string | null;
  location_id: string | null;
  planner_event_id: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_META: Record<string, { label: string; badge: string; next?: { tier: string; label: string; price: string } }> = {
  organic:      { label: "Organisch",   badge: "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--line-subtle)]", next: { tier: "partner_basic", label: "Partner Basic werden", price: "49 €/Monat" } },
  featured:     { label: "Featured",    badge: "bg-blue-50 text-blue-800 border-blue-200", next: { tier: "partner_pro", label: "Auf Pro upgraden", price: "149 €/Monat" } },
  partner_basic:{ label: "Basic",       badge: "bg-blue-50 text-blue-800 border-blue-200", next: { tier: "partner_pro", label: "Auf Pro upgraden", price: "149 €/Monat" } },
  partner_pro:  { label: "Pro",         badge: "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)] border-[var(--brand-accent)]" },
  city_pro_plus:{ label: "City Pro+",   badge: "bg-purple-50 text-purple-800 border-purple-200" },
  strategic:    { label: "Strategic",   badge: "bg-[var(--bg-surface)] text-[var(--text-strong)] border-[var(--line-subtle)]" },
};

const BILLING_META: Record<string, { label: string; badge: string }> = {
  inactive:   { label: "Kostenlos",      badge: "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--line-subtle)]" },
  manual:     { label: "Manuell",        badge: "bg-blue-50 text-blue-800 border-blue-200" },
  trial:      { label: "Testphase",      badge: "bg-amber-50 text-amber-800 border-amber-200" },
  active:     { label: "Aktiv",          badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  past_due:   { label: "Zahlung offen",  badge: "bg-red-50 text-red-800 border-red-200" },
  cancelled:  { label: "Gekündigt",      badge: "bg-red-50 text-red-800 border-red-200" },
};

const BOOKING_STATUS: Record<string, { label: string; badge: string }> = {
  interested: { label: "Neu",          badge: "bg-blue-50 text-blue-800 border-blue-200" },
  pending:    { label: "Ausstehend",   badge: "bg-amber-50 text-amber-800 border-amber-200" },
  confirmed:  { label: "Bestätigt",   badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined:   { label: "Abgelehnt",   badge: "bg-red-50 text-red-800 border-red-200" },
  cancelled:  { label: "Storniert",   badge: "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--line-subtle)]" },
};

const PARTNER_TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurant", venue: "Venue", organizer: "Veranstalter",
  ticketing: "Ticketing", experience: "Erlebnis", tourism: "Tourismus",
  publisher: "Publisher", brand: "Marke", creator_agency: "Creator-Agentur", other: "Sonstiges",
};

const NEED_LABEL: Record<string, string> = {
  location: "Location", catering: "Catering", musik: "Musik / DJ",
  deko: "Dekoration", florist: "Florist", fotografie: "Fotografie",
  video: "Videografie", moderation: "Moderation", animation: "Animation",
  torte: "Torte", technik: "Technik / AV", transport: "Transport",
};

const PARTNER_TYPE_SLUG_LABEL: Record<string, string> = {
  gastronomy:    "Gastronomie",
  venue:         "Venue / Location",
  experience:    "Erlebnis",
  accommodation: "Unterkunft",
  event_vendor:  "Event-Dienstleister",
  city_tourism:  "Stadtmarketing",
  corporate:     "Corporate",
  other:         "Sonstiges",
};

const TYPE_DATA_LABELS: Record<string, string> = {
  seating_capacity:      "Sitzplätze (innen)",
  private_room_capacity: "Privatraum (Personen)",
  max_capacity:          "Max. Kapazität",
  min_hire_hours:        "Mindestmietdauer (h)",
  duration_minutes:      "Dauer (Min.)",
  min_group_size:        "Min. Gruppengröße",
  max_group_size:        "Max. Gruppengröße",
  room_count:            "Zimmeranzahl",
  check_in:              "Check-in",
  check_out:             "Check-out",
  coverage_radius_km:    "Einsatzradius (km)",
  min_booking_hours:     "Mindestbuchung (h)",
  annual_visitors:       "Besucher/Jahr",
};

const BOOKING_TYPE_LABEL: Record<string, string> = {
  request:  "Anfrage (wir melden uns)",
  direct:   "Direkt buchbar",
  external: "Extern (eigene Website)",
  none:     "Keine Buchung",
};

const REVIEW_META: Record<ReviewStatus, { label: string; tone: "draft" | "ready" | "active" }> = {
  draft: { label: "Entwurf", tone: "draft" },
  submitted: { label: "Eingereicht", tone: "ready" },
  in_review: { label: "In Pruefung", tone: "ready" },
  changes_requested: { label: "Aenderungen noetig", tone: "draft" },
  approved: { label: "Freigegeben", tone: "ready" },
  published: { label: "Veroeffentlicht", tone: "active" },
};

// ── Self-service: category → service_type mapping ─────────────────────────────

// Maps partner_type_slug and service_category_slugs to the service_type values
// used in the service_providers table (and queried by the events plan page).
const CATEGORY_TO_SERVICE_TYPE: Record<string, string> = {
  dj_music:     "dj",
  photography:  "photography",
  video:        "video",
  decoration:   "decoration",
  catering:     "catering",
  transport:    "transport",
  florist:      "florist",
  moderation:   "moderator",
  // venue categories all map to "location"
  historic: "location", modern: "location", outdoor: "location",
  rooftop: "location", garden: "location", wedding: "location",
  corporate: "location", party: "location",
  // gastronomy categories → catering
  italian: "catering", german: "catering", asian: "catering",
  mediterranean: "catering", vegan: "catering", cocktails: "catering",
  private_room: "catering",
  // experience → animation
  city_tour: "animation", cooking: "animation", wine: "animation",
  outdoor_experience: "animation", cultural: "animation",
  sports: "animation", team_building: "animation",
};

const PARTNER_TYPE_DEFAULT_SERVICE_TYPE: Record<string, string> = {
  gastronomy:    "catering",
  venue:         "location",
  experience:    "animation",
  accommodation: "location",
  city_tourism:  "animation",
  event_vendor:  "photography",  // sensible default; user can change
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  dj:          "DJ / Musik",
  photography: "Fotografie",
  video:       "Video",
  decoration:  "Dekoration",
  catering:    "Catering",
  transport:   "Transport",
  florist:     "Florist",
  moderator:   "Moderation",
  location:    "Location / Venue",
  animation:   "Animation / Aktivität",
  cake:        "Torte",
  technology:  "Technik / AV",
  band:        "Band",
  entertainment: "Entertainment",
};

const PRICE_UNIT_LABEL: Record<string, string> = {
  total:      "Pauschalpreis",
  per_person: "Pro Person",
  per_hour:   "Pro Stunde",
};

const CAMPAIGN_TYPE_OPTIONS = [
  { value: "featured_location", label: "Featured Standort" },
  { value: "featured_event", label: "Featured Event" },
  { value: "sponsored_placement", label: "Sponsored Placement" },
  { value: "city_spotlight", label: "City Spotlight" },
  { value: "creator_distribution", label: "Route / Creator Distribution" },
] as const;

const AFFILIATE_SCOPE_OPTIONS = [
  { value: "hotel", label: "Hotel / Unterkunft" },
  { value: "ticket", label: "Event / Ticket" },
  { value: "experience", label: "Erlebnis" },
  { value: "restaurant", label: "Restaurant / Reservierung" },
  { value: "tourism", label: "Tourismus / Attraction" },
] as const;

const COMMISSION_MODEL_OPTIONS = [
  { value: "cps", label: "CPS" },
  { value: "cpl", label: "CPL" },
  { value: "cpc", label: "CPC" },
] as const;

// Derive which service_types are relevant for a given partner profile.
function getAvailableServiceTypes(profile: PartnerProfile): string[] {
  const fromCategories = (profile.service_category_slugs ?? [])
    .map((c) => CATEGORY_TO_SERVICE_TYPE[c])
    .filter(Boolean);

  const fromType = PARTNER_TYPE_DEFAULT_SERVICE_TYPE[profile.partner_type_slug];

  const all = [...new Set([...fromCategories, fromType, ...Object.keys(SERVICE_TYPE_LABEL)])].filter(Boolean);
  // Put the most relevant ones first
  const primary = [...new Set([...fromCategories, fromType].filter(Boolean))];
  const rest = all.filter((t) => !primary.includes(t));
  return [...primary, ...rest];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPrice(cents: number, unit: string) {
  const base = (cents / 100).toLocaleString("de-DE");
  return unit === "per_person" ? `${base} €/Person` : `${base} €`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ id, title, subtitle, action, children }: {
  id?: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function AssetStatusPill({ label, tone }: { label: string; tone: "draft" | "ready" | "active" }) {
  const toneClass =
    tone === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "ready"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

function ReviewStatusPill({ status }: { status: ReviewStatus }) {
  const meta = REVIEW_META[status] ?? REVIEW_META.draft;
  return <AssetStatusPill label={meta.label} tone={meta.tone} />;
}

function AssetBuilderCard({
  title,
  subtitle,
  status,
  metric,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  status: React.ReactNode;
  metric: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-left transition ${
        active
          ? "border-[var(--text-strong)] bg-white shadow-sm"
          : "border-[var(--line-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-strong)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">{title}</div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
        {status}
      </div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{metric}</div>
    </button>
  );
}

function formatOptionalDateRange(start: string | null, end: string | null) {
  if (start && end) return `${formatDate(start)} bis ${formatDate(end)}`;
  if (start) return `ab ${formatDate(start)}`;
  if (end) return `bis ${formatDate(end)}`;
  return "ohne Zeitraum";
}

function getUniqueCities(profile: PartnerProfile) {
  return Array.from(
    new Set(
      [profile.primary_city_slug, ...(profile.operating_cities ?? [])].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  const [stats, setStats] = useState<Stats>({ impressions: 0, clicks: 0, bookings: 0 });
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [affiliateClickCounts, setAffiliateClickCounts] = useState<Record<string, number>>({});

  // Profile edit
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: "", website_url: "", booking_url: "", contact_email: "", contact_phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Booking status update
  const [bookingUpdating, setBookingUpdating] = useState<string | null>(null);

  // Upgrade
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // ── Self-service provider management ──────────────────────────────────────
  const [showAddProvider, setShowAddProvider]     = useState(false);
  const [newProvider, setNewProvider]             = useState<NewProviderForm>({ name: "", service_type: "", city_slug: "", description: "" });
  const [addingProvider, setAddingProvider]       = useState(false);
  const [addProviderError, setAddProviderError]   = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider]   = useState<string | null>(null);

  const [addPkgFor, setAddPkgFor]                 = useState<string | null>(null);   // provider id
  const [newPkg, setNewPkg]                       = useState<NewPackageForm>({ name: "", price: "", price_unit: "total", description: "", includes: "", min_guests: "", max_guests: "" });
  const [addingPkg, setAddingPkg]                 = useState(false);
  const [addPkgError, setAddPkgError]             = useState<string | null>(null);
  const [deletingPkg, setDeletingPkg]             = useState<string | null>(null);

  const [newCampaign, setNewCampaign]             = useState<NewCampaignForm>({
    name: "",
    campaign_type: "featured_location",
    city_slug: "",
    starts_at: "",
    ends_at: "",
    cta_label: "",
    cta_url: "",
    target_kind: "location",
    target_id: "",
  });
  const [addingCampaign, setAddingCampaign]       = useState(false);
  const [addCampaignError, setAddCampaignError]   = useState<string | null>(null);
  const [campaignUpdating, setCampaignUpdating]   = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign]   = useState<string | null>(null);

  const [newAffiliate, setNewAffiliate]           = useState<NewAffiliateLinkForm>({
    provider_name: "",
    destination_url: "",
    commission_model: "cps",
    link_scope: "hotel",
    target_kind: "none",
    target_id: "",
  });
  const [addingAffiliate, setAddingAffiliate]     = useState(false);
  const [addAffiliateError, setAddAffiliateError] = useState<string | null>(null);
  const [affiliateUpdating, setAffiliateUpdating] = useState<string | null>(null);
  const [deletingAffiliate, setDeletingAffiliate] = useState<string | null>(null);
  const [selectedAssetBuilder, setSelectedAssetBuilder] = useState<AssetBuilderType>("location");
  const [reviewUpdatingKey, setReviewUpdatingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNeedsAuth(false);
    setNoAccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNeedsAuth(true);
        router.replace("/profile?return=/partner/dashboard");
        return;
      }
      const userId = session.user.id;
      setUserId(userId);

      // Load membership + profile
      const { data: membership, error: membershipErr } = await supabase
        .from("partner_memberships")
        .select(`
          role,
          partner_profiles (
            id, display_name, partner_type, partner_type_slug, visibility_tier, billing_status,
            status, website_url, booking_url, contact_email, contact_phone,
            primary_city_slug, notes,
            service_category_slugs, operating_cities, media_urls, type_data, booking_type,
            review_status, review_notes, review_submitted_at, review_reviewed_at, published_at
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipErr || !membership || !membership.partner_profiles) {
        setNoAccess(true);
        return;
      }

      const prof = membership.partner_profiles as unknown as PartnerProfile;
      setProfile(prof);
      setRole(membership.role);
      setEditForm({
        display_name:  prof.display_name,
        website_url:   prof.website_url ?? "",
        booking_url:   prof.booking_url ?? "",
        contact_email: prof.contact_email ?? "",
        contact_phone: prof.contact_phone ?? "",
        notes:         prof.notes ?? "",
      });

      const now = new Date();
      const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Load stats in parallel — query attribution_events directly (partner_impressions/partner_clicks tables are not populated)
      const [
        impressionResult,
        clickResult,
        providersResult,
        campaignsResult,
        affiliateLinksResult,
        affiliateClickBreakdownResult,
      ] = await Promise.all([
        supabase
          .from("attribution_events")
          .select("id", { count: "exact", head: true })
          .eq("partner_profile_id", prof.id)
          .eq("event_type", "impression")
          .gte("occurred_at", since30d),
        supabase
          .from("attribution_events")
          .select("id", { count: "exact", head: true })
          .eq("partner_profile_id", prof.id)
          .in("event_type", ["click", "redirect"])
          .gte("occurred_at", since30d),
        supabase
          .from("service_providers")
          .select(`
            id, name, service_type, description, is_verified, status, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at,
            provider_packages ( id, name, price_cents, price_unit, status )
          `)
          .eq("partner_profile_id", prof.id),
        supabase
          .from("partner_campaigns")
          .select("id, name, campaign_type, status, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at, city_slug, starts_at, ends_at, cta_label, target_route_id, target_location_id, target_event_id")
          .eq("partner_profile_id", prof.id)
          .order("updated_at", { ascending: false })
          .limit(12),
        supabase
          .from("affiliate_links")
          .select("id, link_scope, provider_name, commission_model, destination_url, is_active, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at, route_id, location_id, planner_event_id")
          .eq("partner_profile_id", prof.id)
          .order("updated_at", { ascending: false })
          .limit(12),
        supabase
          .from("attribution_events")
          .select("affiliate_link_id")
          .eq("partner_profile_id", prof.id)
          .in("event_type", ["click", "redirect"])
          .not("affiliate_link_id", "is", null)
          .gte("occurred_at", since30d)
          .limit(500),
      ]);

      // Build click count per affiliate link
      const clicksByLinkId = (affiliateClickBreakdownResult.data ?? []).reduce<Record<string, number>>(
        (acc, row) => {
          const id = row.affiliate_link_id as string;
          if (id) acc[id] = (acc[id] ?? 0) + 1;
          return acc;
        },
        {}
      );
      setAffiliateClickCounts(clicksByLinkId);

      const impressionCount = impressionResult.count;
      const clickCount = clickResult.count;

      const providerList = (providersResult.data ?? []) as unknown as ServiceProvider[];
      setProviders(providerList);
      setCampaigns((campaignsResult.data ?? []) as PartnerCampaign[]);
      setAffiliateLinks((affiliateLinksResult.data ?? []) as AffiliateLink[]);

      // Booking requests for this partner's providers
      const providerIds = providerList.map((p) => p.id);
      let bookingList: BookingRequest[] = [];
      if (providerIds.length > 0) {
        const { data: bkgs } = await supabase
          .from("event_bookings")
          .select(`
            id, need_slug, price_cents_agreed, status, created_at,
            service_providers ( id, name ),
            provider_packages ( id, name, price_cents, price_unit ),
            event_plans ( id, title, occasion_slug, guest_count, event_date )
          `)
          .in("service_provider_id", providerIds)
          .order("created_at", { ascending: false })
          .limit(50);
        bookingList = (bkgs ?? []) as unknown as BookingRequest[];
      }
      setBookings(bookingList);

      const bookingCount30d = bookingList.filter(
        (b) => new Date(b.created_at) >= new Date(since30d)
      ).length;

      setStats({
        impressions: impressionCount ?? 0,
        clicks:      clickCount ?? 0,
        bookings:    bookingCount30d,
      });
    } catch {
      setNoAccess(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("partner_profiles")
      .update({
        display_name:  editForm.display_name.trim() || profile.display_name,
        website_url:   editForm.website_url.trim() || null,
        booking_url:   editForm.booking_url.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        contact_phone: editForm.contact_phone.trim() || null,
        notes:         editForm.notes.trim() || null,
      })
      .eq("id", profile.id);

    if (error) {
      setSaveError("Speichern fehlgeschlagen — bitte erneut versuchen.");
    } else {
      setProfile((prev) => prev ? { ...prev, ...editForm } : prev);
      setEditMode(false);
    }
    setSaving(false);
  }

  async function handleBookingStatus(bookingId: string, newStatus: "confirmed" | "declined") {
    setBookingUpdating(bookingId);
    const { error } = await supabase
      .from("event_bookings")
      .update({ status: newStatus })
      .eq("id", bookingId);

    if (!error) {
      setBookings((prev) =>
        prev.map((b) => b.id === bookingId ? { ...b, status: newStatus } : b)
      );
    }
    setBookingUpdating(null);
  }

  async function handleUpgrade() {
    if (!profile) return;
    const tierMeta = TIER_META[profile.visibility_tier];
    if (!tierMeta?.next) return;

    setUpgrading(true);
    setUpgradeError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tierMeta.next.tier,
          partner_entity_id: profile.id,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeError(data.error ?? "Checkout konnte nicht erstellt werden.");
      }
    } catch {
      setUpgradeError("Netzwerkfehler — bitte erneut versuchen.");
    }
    setUpgrading(false);
  }

  // ── Self-service provider handlers ──────────────────────────────────────────

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function handleAddProvider() {
    if (!profile || !newProvider.name.trim() || !newProvider.service_type || !newProvider.city_slug) return;
    setAddingProvider(true);
    setAddProviderError(null);

    const token = await getAccessToken();
    if (!token) { setAddProviderError("Nicht eingeloggt."); setAddingProvider(false); return; }

    const citySlugs = Array.from(new Set([newProvider.city_slug, ...(profile.operating_cities ?? [])].filter(Boolean)));

    const res = await fetch("/api/partner/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name:         newProvider.name.trim(),
        service_type: newProvider.service_type,
        city_slug:    newProvider.city_slug,
        city_slugs:   citySlugs,
        description:  newProvider.description.trim() || undefined,
      }),
    });

    const data = await res.json() as { provider?: ServiceProvider; error?: string };

    if (!res.ok || !data.provider) {
      setAddProviderError(data.error ?? "Fehler beim Erstellen.");
      setAddingProvider(false);
      return;
    }

    setProviders((prev) => [...prev, { ...data.provider!, provider_packages: [] }]);
    setShowAddProvider(false);
    setNewProvider({ name: "", service_type: "", city_slug: "", description: "" });
    setAddingProvider(false);
  }

  async function handleDeleteProvider(providerId: string) {
    if (!confirm("Dienstleister-Eintrag wirklich löschen? Alle Pakete werden ebenfalls gelöscht.")) return;
    setDeletingProvider(providerId);

    const token = await getAccessToken();
    if (!token) { setDeletingProvider(null); return; }

    const res = await fetch(`/api/partner/providers/${providerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== providerId));
    }
    setDeletingProvider(null);
  }

  async function handleAddPackage(providerId: string) {
    if (!newPkg.name.trim() || !newPkg.price || !newPkg.price_unit) return;
    setAddingPkg(true);
    setAddPkgError(null);

    const token = await getAccessToken();
    if (!token) { setAddPkgError("Nicht eingeloggt."); setAddingPkg(false); return; }

    const priceCents = Math.round(parseFloat(newPkg.price.replace(",", ".")) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setAddPkgError("Ungültiger Preis."); setAddingPkg(false); return;
    }

    const includes = newPkg.includes
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(`/api/partner/providers/${providerId}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name:        newPkg.name.trim(),
        price_cents: priceCents,
        price_unit:  newPkg.price_unit,
        description: newPkg.description.trim() || undefined,
        includes,
        min_guests:  newPkg.min_guests ? parseInt(newPkg.min_guests) : null,
        max_guests:  newPkg.max_guests ? parseInt(newPkg.max_guests) : null,
      }),
    });

    const data = await res.json() as { pkg?: ProviderPackage; error?: string };

    if (!res.ok || !data.pkg) {
      setAddPkgError(data.error ?? "Fehler beim Erstellen.");
      setAddingPkg(false);
      return;
    }

    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, provider_packages: [...p.provider_packages, data.pkg!] }
          : p
      )
    );
    setAddPkgFor(null);
    setNewPkg({ name: "", price: "", price_unit: "total", description: "", includes: "", min_guests: "", max_guests: "" });
    setAddingPkg(false);
  }

  async function handleDeletePackage(providerId: string, pkgId: string) {
    if (!confirm("Paket wirklich löschen?")) return;
    setDeletingPkg(pkgId);

    const token = await getAccessToken();
    if (!token) { setDeletingPkg(null); return; }

    const res = await fetch(`/api/partner/providers/${providerId}/packages/${pkgId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, provider_packages: p.provider_packages.filter((pkg) => pkg.id !== pkgId) }
            : p
        )
      );
    }
    setDeletingPkg(null);
  }

  // ─── Render states ────────────────────────────────────────────────────────

  async function handleAddCampaign() {
    if (!profile || !newCampaign.name.trim() || !newCampaign.campaign_type) return;
    setAddingCampaign(true);
    setAddCampaignError(null);

    const token = await getAccessToken();
    if (!token) {
      setAddCampaignError("Nicht eingeloggt.");
      setAddingCampaign(false);
      return;
    }

    const res = await fetch("/api/partner/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newCampaign.name.trim(),
        campaign_type: newCampaign.campaign_type,
        city_slug: newCampaign.city_slug || profile.primary_city_slug || null,
        starts_at: newCampaign.starts_at || null,
        ends_at: newCampaign.ends_at || null,
        cta_label: newCampaign.cta_label.trim() || null,
        cta_url: newCampaign.cta_url.trim() || null,
        target_route_id: newCampaign.target_kind === "route" ? newCampaign.target_id.trim() || null : null,
        target_location_id: newCampaign.target_kind === "location" ? newCampaign.target_id.trim() || null : null,
        target_event_id: newCampaign.target_kind === "event" ? newCampaign.target_id.trim() || null : null,
      }),
    });

    const data = await res.json() as { campaign?: PartnerCampaign; error?: string };
    if (!res.ok || !data.campaign) {
      setAddCampaignError(data.error ?? "Fehler beim Erstellen.");
      setAddingCampaign(false);
      return;
    }

    setCampaigns((prev) => [data.campaign!, ...prev]);
    setNewCampaign({
      name: "",
      campaign_type: "featured_location",
      city_slug: profile.primary_city_slug ?? "",
      starts_at: "",
      ends_at: "",
      cta_label: "",
      cta_url: "",
      target_kind: "location",
      target_id: "",
    });
    setAddingCampaign(false);
  }

  async function handleCampaignStatus(campaignId: string, status: string) {
    setCampaignUpdating(campaignId);
    const token = await getAccessToken();
    if (!token) {
      setCampaignUpdating(null);
      return;
    }

    const res = await fetch(`/api/partner/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setCampaigns((prev) => prev.map((campaign) => (
        campaign.id === campaignId ? { ...campaign, status } : campaign
      )));
    }

    setCampaignUpdating(null);
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm("Kampagne wirklich loeschen?")) return;
    setDeletingCampaign(campaignId);
    const token = await getAccessToken();
    if (!token) {
      setDeletingCampaign(null);
      return;
    }

    const res = await fetch(`/api/partner/campaigns/${campaignId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignId));
    }

    setDeletingCampaign(null);
  }

  async function handleAddAffiliateLink() {
    if (!newAffiliate.provider_name.trim() || !newAffiliate.destination_url.trim()) return;
    setAddingAffiliate(true);
    setAddAffiliateError(null);

    const token = await getAccessToken();
    if (!token) {
      setAddAffiliateError("Nicht eingeloggt.");
      setAddingAffiliate(false);
      return;
    }

    const res = await fetch("/api/partner/affiliate-links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        provider_name: newAffiliate.provider_name.trim(),
        destination_url: newAffiliate.destination_url.trim(),
        commission_model: newAffiliate.commission_model,
        link_scope: newAffiliate.link_scope,
        route_id: newAffiliate.target_kind === "route" ? newAffiliate.target_id.trim() || null : null,
        location_id: newAffiliate.target_kind === "location" ? newAffiliate.target_id.trim() || null : null,
        planner_event_id: newAffiliate.target_kind === "planner_event" ? newAffiliate.target_id.trim() || null : null,
      }),
    });

    const data = await res.json() as { affiliateLink?: AffiliateLink; error?: string };
    if (!res.ok || !data.affiliateLink) {
      setAddAffiliateError(data.error ?? "Fehler beim Erstellen.");
      setAddingAffiliate(false);
      return;
    }

    setAffiliateLinks((prev) => [data.affiliateLink!, ...prev]);
    setNewAffiliate({
      provider_name: "",
      destination_url: "",
      commission_model: "cps",
      link_scope: "hotel",
      target_kind: "none",
      target_id: "",
    });
    setAddingAffiliate(false);
  }

  async function handleAffiliateState(affiliateId: string, isActive: boolean) {
    setAffiliateUpdating(affiliateId);
    const token = await getAccessToken();
    if (!token) {
      setAffiliateUpdating(null);
      return;
    }

    const res = await fetch(`/api/partner/affiliate-links/${affiliateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: isActive }),
    });

    if (res.ok) {
      setAffiliateLinks((prev) => prev.map((link) => (
        link.id === affiliateId ? { ...link, is_active: isActive } : link
      )));
    }

    setAffiliateUpdating(null);
  }

  async function handleDeleteAffiliate(affiliateId: string) {
    if (!confirm("Affiliate-Link wirklich loeschen?")) return;
    setDeletingAffiliate(affiliateId);
    const token = await getAccessToken();
    if (!token) {
      setDeletingAffiliate(null);
      return;
    }

    const res = await fetch(`/api/partner/affiliate-links/${affiliateId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setAffiliateLinks((prev) => prev.filter((link) => link.id !== affiliateId));
    }

    setDeletingAffiliate(null);
  }

  async function handleReviewAction(entity: ReviewEntity, targetId: string | null, action: "submit" | "withdraw") {
    const key = `${entity}:${targetId ?? "self"}:${action}`;
    setReviewUpdatingKey(key);

    try {
      const token = await getAccessToken();
      if (!token) {
        setReviewUpdatingKey(null);
        return;
      }

      const res = await fetch("/api/partner/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entity, targetId, action }),
      });

      const data = (await res.json()) as {
        review?: {
          review_status: ReviewStatus;
          review_notes: string | null;
          review_submitted_at: string | null;
          review_reviewed_at: string | null;
          published_at: string | null;
        };
      };

      if (!res.ok || !data.review) {
        setReviewUpdatingKey(null);
        return;
      }

      const reviewPatch = {
        review_status: data.review.review_status,
        review_notes: data.review.review_notes,
        review_submitted_at: data.review.review_submitted_at,
        review_reviewed_at: data.review.review_reviewed_at,
        published_at: data.review.published_at,
      };

      if (entity === "profile") {
        setProfile((prev) => (prev ? { ...prev, ...reviewPatch } : prev));
      } else if (entity === "provider" && targetId) {
        setProviders((prev) => prev.map((provider) => (
          provider.id === targetId ? { ...provider, ...reviewPatch } : provider
        )));
      } else if (entity === "campaign" && targetId) {
        setCampaigns((prev) => prev.map((campaign) => (
          campaign.id === targetId ? { ...campaign, ...reviewPatch } : campaign
        )));
      } else if (entity === "affiliate" && targetId) {
        setAffiliateLinks((prev) => prev.map((affiliate) => (
          affiliate.id === targetId ? { ...affiliate, ...reviewPatch } : affiliate
        )));
      }
    } finally {
      setReviewUpdatingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 h-40 animate-pulse rounded-[28px] bg-[var(--bg-surface)]" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[24px] bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-semibold text-[var(--text-strong)]">Anmeldung erforderlich</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Melde dich an, damit wir dein Partner-Profil laden und dein Dashboard oeffnen koennen.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/profile?return=/partner/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Zum Login
          </a>
          <a
            href="/partner/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white px-6 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Partner-Portal anlegen
          </a>
        </div>
      </div>
    );
  }

  if (noAccess || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-semibold text-[var(--text-strong)]">Kein Partner-Profil gefunden</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Du bist aktuell noch keinem Partner-Profil zugeordnet oder dein Zugriff ist noch nicht freigeschaltet.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/partner/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Jetzt Partner werden →
          </a>
          <a
            href="/profile"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white px-6 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Profil pruefen
          </a>
        </div>
        <a
          href="/partner/onboarding"
          className="mt-6 hidden inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          Jetzt Partner werden →
        </a>
      </div>
    );
  }

  const tierMeta    = TIER_META[profile.visibility_tier]    ?? TIER_META.organic;
  const billingMeta = BILLING_META[profile.billing_status]  ?? BILLING_META.inactive;
  const isAdmin     = role === "owner" || role === "admin";
  const convRate    = stats.impressions > 0
    ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)} %`
    : "—";

  const openBookings = bookings.filter((b) => b.status === "interested" || b.status === "pending");
  const pastBookings = bookings.filter((b) => !["interested", "pending"].includes(b.status));
  const uniqueCities = getUniqueCities(profile);
  const totalPackages = providers.reduce((sum, provider) => sum + provider.provider_packages.length, 0);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const activeAffiliateLinks = affiliateLinks.filter((link) => link.is_active);
  const publishedProviders = providers.filter((provider) => provider.review_status === "published");
  const submittedProviders = providers.filter((provider) => ["submitted", "in_review"].includes(provider.review_status));
  const submittedCampaigns = campaigns.filter((campaign) => ["submitted", "in_review"].includes(campaign.review_status));
  const submittedAffiliates = affiliateLinks.filter((link) => ["submitted", "in_review"].includes(link.review_status));
  const changeRequestItems = [
    profile.review_status === "changes_requested" ? 1 : 0,
    ...providers.map((provider) => (provider.review_status === "changes_requested" ? 1 : 0)),
    ...campaigns.map((campaign) => (campaign.review_status === "changes_requested" ? 1 : 0)),
    ...affiliateLinks.map((link) => (link.review_status === "changes_requested" ? 1 : 0)),
  ].reduce((sum, value) => sum + value, 0);
  const pendingReviewItems =
    (profile.review_status === "submitted" || profile.review_status === "in_review" ? 1 : 0) +
    submittedProviders.length +
    submittedCampaigns.length +
    submittedAffiliates.length;
  const profileReadyForReview = Boolean(
    profile.display_name.trim() &&
    profile.primary_city_slug &&
    (profile.website_url || profile.booking_url || profile.contact_email)
  );
  const profileCompleteness = [
    profile.website_url,
    profile.booking_url,
    profile.contact_email,
    profile.contact_phone,
    profile.notes,
    profile.media_urls?.[0],
  ].filter(Boolean).length;
  const setupTasks = [
    !profile.media_urls?.length ? "Titelbild hochladen, damit dein Eintrag hochwertig erscheint." : null,
    !profile.website_url && !profile.booking_url ? "CTA hinterlegen, damit Interessenten direkt weiterklicken koennen." : null,
    providers.length === 0 ? "Erstes Angebot fuer den Event Planner anlegen." : null,
    profile.review_status === "draft" && profileReadyForReview ? "Profil zur internen Freigabe einreichen." : null,
    pendingReviewItems > 0 ? `${pendingReviewItems} Asset${pendingReviewItems > 1 ? "s" : ""} befinden sich aktuell in der Pruefung.` : null,
    changeRequestItems > 0 ? "Rueckfragen aus der Freigabe pruefen und Assets erneut einreichen." : null,
    openBookings.length > 0 ? `${openBookings.length} offene Anfrage${openBookings.length > 1 ? "n" : ""} beantworten.` : null,
    affiliateLinks.length === 0 ? "Affiliate-Angebot oder externen Buchungslink fuer Tracking aktivieren." : null,
  ].filter(Boolean) as string[];
  const distributionChannels = Array.from(
    new Set([
      providers.length > 0 ? "Event Planner" : null,
      campaigns.some((campaign) => campaign.target_route_id) ? "Route-Details" : null,
      campaigns.some((campaign) => campaign.target_location_id) ? "Location-Details" : null,
      campaigns.some((campaign) => campaign.target_event_id) ? "Event-Details" : null,
      activeAffiliateLinks.some((link) => link.route_id) ? "Roadtrip / Route" : null,
      activeAffiliateLinks.some((link) => link.location_id) ? "Location / Spot" : null,
      activeAffiliateLinks.some((link) => link.planner_event_id) ? "Event-Planung" : null,
    ].filter(Boolean))
  ) as string[];
  const eventCampaignCount = campaigns.filter((campaign) => campaign.campaign_type === "featured_event").length;
  const routeCampaignCount = campaigns.filter((campaign) => campaign.campaign_type === "creator_distribution" || campaign.target_route_id).length;
  const locationReady = Boolean(newProvider.name.trim() && newProvider.service_type && newProvider.city_slug);
  const eventReady = Boolean(newCampaign.name.trim() && (newCampaign.cta_label.trim() || newCampaign.cta_url.trim()));
  const routeReady = Boolean(newCampaign.name.trim() && newCampaign.target_kind === "route");
  const affiliateReady = Boolean(newAffiliate.provider_name.trim() && newAffiliate.destination_url.trim());

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── A) Status Header ─────────────────────────────────────────────────── */}
      <div className="mb-8 rounded-[36px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-7 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="pd24-kicker mb-1">Partner Studio</div>
            <h1 className="truncate text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
              {profile.display_name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              {PARTNER_TYPE_LABEL[profile.partner_type] ?? profile.partner_type}
              {profile.primary_city_slug ? ` - ${profile.primary_city_slug}` : ""}
              {" - "}Verwalte Profil, Angebote, Sichtbarkeit und Buchungswege an einem Ort.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tierMeta.badge}`}>
                {tierMeta.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${billingMeta.badge}`}>
                {billingMeta.label}
              </span>
              <ReviewStatusPill status={profile.review_status} />
              {role && (
                <span className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
                  {role}
                </span>
              )}
            </div>
          </div>

          {tierMeta.next && isAdmin && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={() => void handleUpgrade()}
                disabled={upgrading}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {upgrading ? "Weiterleitung …" : `${tierMeta.next.label}`}
                {!upgrading && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                    {tierMeta.next.price}
                  </span>
                )}
              </button>
              {upgradeError && (
                <p className="text-xs text-red-600">{upgradeError}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Veroeffentlicht</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
              {(publishedProviders.length + activeAffiliateLinks.filter((link) => link.review_status === "published").length + campaigns.filter((campaign) => campaign.review_status === "published").length + (profile.review_status === "published" ? 1 : 0)).toLocaleString("de-DE")}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Profil, Angebote, Links und Kampagnen mit Freigabe.</p>
          </div>
          <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profil-Readiness</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">
              {Math.min(100, Math.round((profileCompleteness / 6) * 100))}%
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Kontakt, CTA, Copy und Medien fuer bessere Conversion.</p>
          </div>
          <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">In Review</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{pendingReviewItems}</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Eingereichte Assets und Profilbausteine in der Pruefung.</p>
          </div>
          <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Aenderungen offen</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">{changeRequestItems}</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Assets mit Rueckfragen oder noetigen Nachschaerfungen.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="#assets"
            className="inline-flex items-center rounded-2xl bg-[var(--text-strong)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Assets verwalten
          </a>
          <a
            href="#inquiries"
            className="inline-flex items-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Anfragen pruefen
          </a>
          <a
            href="#review"
            className="inline-flex items-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Freigaben steuern
          </a>
          <a
            href="#profile"
            className="inline-flex items-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
          >
            Profil optimieren
          </a>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            ["review", "Freigaben"],
            ["overview", "Uebersicht"],
            ["asset-studio", "Asset Studio"],
            ["visibility", "Sichtbarkeit"],
            ["inquiries", "Anfragen"],
            ["assets", "Assets"],
            ["profile", "Profil"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
            >
              {label}
            </a>
          ))}
        </div>

        <Section
          id="review"
          title="Review und Freigabe"
          subtitle="Reiche Profil und Assets fuer die interne Qualitaetspruefung ein und verfolge den Publish-Status."
        >
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profil-Freigabe</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-[var(--text-strong)]">{profile.display_name}</span>
                    <ReviewStatusPill status={profile.review_status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    Dein Profil sollte Basisdaten, Kontaktweg und mindestens einen klaren Buchungs- oder Website-Einstieg haben.
                  </p>
                </div>
                <AssetStatusPill
                  label={profileReadyForReview ? "Review-ready" : "Profil unvollstaendig"}
                  tone={profileReadyForReview ? "ready" : "draft"}
                />
              </div>
              {profile.review_notes ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {profile.review_notes}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void handleReviewAction("profile", null, "submit")}
                  disabled={!isAdmin || !profileReadyForReview || reviewUpdatingKey === "profile:self:submit"}
                  className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {reviewUpdatingKey === "profile:self:submit" ? "Wird eingereicht..." : "Profil zur Freigabe senden"}
                </button>
                {["submitted", "in_review"].includes(profile.review_status) ? (
                  <button
                    onClick={() => void handleReviewAction("profile", null, "withdraw")}
                    disabled={!isAdmin || reviewUpdatingKey === "profile:self:withdraw"}
                    className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                  >
                    {reviewUpdatingKey === "profile:self:withdraw" ? "..." : "Einreichung zurueckziehen"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Asset-Queue</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{pendingReviewItems}</div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Zur Zeit in Pruefung oder bereits eingereicht.</p>
              </div>
              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Veroeffentlicht</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                  {publishedProviders.length + campaigns.filter((campaign) => campaign.review_status === "published").length + affiliateLinks.filter((link) => link.review_status === "published").length}
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Assets mit erfolgter Freigabe und Publish-Status.</p>
              </div>
              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Rueckfragen</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{changeRequestItems}</div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Nacharbeiten, die vor dem Publish erledigt werden sollten.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="overview"
          title="Arbeitsstand im Portal"
          subtitle="Die naechsten Schritte fuer mehr Sichtbarkeit, mehr Leads und saubere Buchungswege."
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Setup-Fortschritt</div>
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {profileCompleteness}/6 erledigt
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-warm)] transition-all"
                  style={{ width: `${Math.round((profileCompleteness / 6) * 100)}%` }}
                />
              </div>
              <div className="mt-4 space-y-2.5">
                {setupTasks.length > 0 ? (
                  setupTasks.map((task) => (
                    <div key={task} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                      <span className="mt-0.5 shrink-0 text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <p className="text-sm leading-6 text-[var(--text-strong)]">{task}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <span className="shrink-0 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <p className="text-sm text-emerald-800">Dein Partnerprofil ist vollstaendig aufgestellt.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Wo du aktuell ausgespielt wirst</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {distributionChannels.length > 0 ? (
                  distributionChannels.map((channel) => (
                    <span
                      key={channel}
                      className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]"
                    >
                      {channel}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">Noch keine aktive Ausspielung hinterlegt.</span>
                )}
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Buchungsmodus</dt>
                  <dd className="font-medium text-[var(--text-strong)]">
                    {BOOKING_TYPE_LABEL[profile.booking_type] ?? profile.booking_type}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Staedte</dt>
                  <dd className="font-medium text-[var(--text-strong)]">{uniqueCities.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Medien</dt>
                  <dd className="font-medium text-[var(--text-strong)]">{profile.media_urls?.length ?? 0}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Section>


        {/* ── B) KPIs ──────────────────────────────────────────────────────── */}
        <Section
          id="asset-studio"
          title="Asset Studio"
          subtitle="Vier gefuehrte Builder fuer Standort, Event, Route und Affiliate-Angebot."
        >
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <AssetBuilderCard
                title="Standort"
                subtitle="Venue, Hotel, Gastro oder Erlebnis fuer Planner und Buchungsanfragen."
                metric={`${providers.length} aktive Angebote`}
                status={<AssetStatusPill label={locationReady ? "Bereit" : "Entwurf"} tone={locationReady ? "ready" : "draft"} />}
                active={selectedAssetBuilder === "location"}
                onClick={() => setSelectedAssetBuilder("location")}
              />
              <AssetBuilderCard
                title="Event"
                subtitle="Featured Event oder Event-Kampagne mit Zeitraum und CTA."
                metric={`${eventCampaignCount} Event-Kampagnen`}
                status={<AssetStatusPill label={eventCampaignCount > 0 ? "Live-Bestand" : eventReady ? "Bereit" : "Entwurf"} tone={eventCampaignCount > 0 ? "active" : eventReady ? "ready" : "draft"} />}
                active={selectedAssetBuilder === "event"}
                onClick={() => {
                  setSelectedAssetBuilder("event");
                  setNewCampaign((prev) => ({ ...prev, campaign_type: "featured_event", target_kind: "event", city_slug: prev.city_slug || profile.primary_city_slug || "" }));
                }}
              />
              <AssetBuilderCard
                title="Route"
                subtitle="Route-Distribution, Roadtrip oder Creator-Routen mit klarer Stop-Story."
                metric={`${routeCampaignCount} Route-Assets`}
                status={<AssetStatusPill label={routeCampaignCount > 0 ? "Live-Bestand" : routeReady ? "Bereit" : "Entwurf"} tone={routeCampaignCount > 0 ? "active" : routeReady ? "ready" : "draft"} />}
                active={selectedAssetBuilder === "route"}
                onClick={() => {
                  setSelectedAssetBuilder("route");
                  setNewCampaign((prev) => ({ ...prev, campaign_type: "creator_distribution", target_kind: "route", city_slug: prev.city_slug || profile.primary_city_slug || "" }));
                }}
              />
              <AssetBuilderCard
                title="Affiliate-Angebot"
                subtitle="Externer Link mit Tracking, Scope und direkter Monetarisierung."
                metric={`${affiliateLinks.length} Affiliate-Links`}
                status={<AssetStatusPill label={activeAffiliateLinks.length > 0 ? "Aktiv" : affiliateReady ? "Bereit" : "Entwurf"} tone={activeAffiliateLinks.length > 0 ? "active" : affiliateReady ? "ready" : "draft"} />}
                active={selectedAssetBuilder === "affiliate"}
                onClick={() => setSelectedAssetBuilder("affiliate")}
              />
            </div>

            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              {selectedAssetBuilder === "location" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Standort-Builder</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Lege einen buchbaren Standort oder Angebotsbaustein fuer den Planner an.</p>
                    </div>
                    <AssetStatusPill label={locationReady ? "Bereit zum Anlegen" : "Pflichtfelder offen"} tone={locationReady ? "ready" : "draft"} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" value={newProvider.name} onChange={(e) => setNewProvider((prev) => ({ ...prev, name: e.target.value }))} placeholder="Standortname" className={inputCls} />
                    <select value={newProvider.service_type} onChange={(e) => setNewProvider((prev) => ({ ...prev, service_type: e.target.value }))} className={inputCls}>
                      <option value="">Kategorie waehlen</option>
                      {getAvailableServiceTypes(profile).map((type) => (
                        <option key={type} value={type}>{SERVICE_TYPE_LABEL[type] ?? type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                    <select value={newProvider.city_slug} onChange={(e) => setNewProvider((prev) => ({ ...prev, city_slug: e.target.value }))} className={inputCls}>
                      <option value="">Stadt waehlen</option>
                      {uniqueCities.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                    <input type="text" value={newProvider.description} onChange={(e) => setNewProvider((prev) => ({ ...prev, description: e.target.value }))} placeholder="Kurzbeschreibung fuer den Eintrag" className={inputCls} />
                  </div>
                  {addProviderError ? <p className="text-xs text-red-600">{addProviderError}</p> : null}
                  <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vorschau</div>
                    <div className="mt-3 rounded-[20px] border border-[var(--line-subtle)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[var(--text-strong)]">{newProvider.name || profile.display_name}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{(SERVICE_TYPE_LABEL[newProvider.service_type] ?? "Kategorie")} - {(newProvider.city_slug || profile.primary_city_slug || "Stadt")}</div>
                        </div>
                        <AssetStatusPill label="Planner" tone="ready" />
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-muted)]">{newProvider.description || "Erscheint als buchbarer Partner-Baustein in passenden Event- und Planner-Kontexten."}</p>
                    </div>
                  </div>
                  <button onClick={() => void handleAddProvider()} disabled={addingProvider || !locationReady} className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    {addingProvider ? "Wird angelegt..." : "Standort anlegen"}
                  </button>
                </div>
              ) : null}

              {selectedAssetBuilder === "event" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Event-Builder</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Erstelle eine Event-Kampagne mit Zeitraum, CTA und klarer Featured-Ausspielung.</p>
                    </div>
                    <AssetStatusPill label={eventReady ? "Bereit zum Start" : "Entwurf"} tone={eventReady ? "ready" : "draft"} />
                  </div>
                  <input type="text" value={newCampaign.name} onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value, campaign_type: "featured_event", target_kind: "event" }))} placeholder="Event-Titel oder Kampagnenname" className={inputCls} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={newCampaign.city_slug} onChange={(e) => setNewCampaign((prev) => ({ ...prev, city_slug: e.target.value }))} className={inputCls}>
                      <option value="">Stadt waehlen</option>
                      {uniqueCities.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                    <input type="text" value={newCampaign.target_id} onChange={(e) => setNewCampaign((prev) => ({ ...prev, target_id: e.target.value }))} placeholder="Event-ID optional" className={inputCls} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="date" value={newCampaign.starts_at} onChange={(e) => setNewCampaign((prev) => ({ ...prev, starts_at: e.target.value }))} className={inputCls} />
                    <input type="date" value={newCampaign.ends_at} onChange={(e) => setNewCampaign((prev) => ({ ...prev, ends_at: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" value={newCampaign.cta_label} onChange={(e) => setNewCampaign((prev) => ({ ...prev, cta_label: e.target.value }))} placeholder="CTA Label" className={inputCls} />
                    <input type="url" value={newCampaign.cta_url} onChange={(e) => setNewCampaign((prev) => ({ ...prev, cta_url: e.target.value }))} placeholder="https://ticket-link.de" className={inputCls} />
                  </div>
                  {addCampaignError ? <p className="text-xs text-red-600">{addCampaignError}</p> : null}
                  <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vorschau</div>
                    <div className="mt-3 rounded-[20px] border border-[var(--line-subtle)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[var(--text-strong)]">{newCampaign.name || "Event-Kampagne"}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{(newCampaign.city_slug || profile.primary_city_slug || "Stadt")} - {formatOptionalDateRange(newCampaign.starts_at || null, newCampaign.ends_at || null)}</div>
                        </div>
                        <AssetStatusPill label="Featured Event" tone="active" />
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-muted)]">CTA: {newCampaign.cta_label || "Tickets ansehen"} {newCampaign.cta_url ? `- ${newCampaign.cta_url}` : ""}</p>
                    </div>
                  </div>
                  <button onClick={() => void handleAddCampaign()} disabled={addingCampaign || !eventReady} className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    {addingCampaign ? "Wird angelegt..." : "Event anlegen"}
                  </button>
                </div>
              ) : null}

              {selectedAssetBuilder === "route" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Route-Builder</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Erstelle ein Route-Asset fuer Explore, Roadtrip oder Creator-Distribution.</p>
                    </div>
                    <AssetStatusPill label={routeReady ? "Bereit zum Start" : "Entwurf"} tone={routeReady ? "ready" : "draft"} />
                  </div>
                  <input type="text" value={newCampaign.name} onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value, campaign_type: "creator_distribution", target_kind: "route" }))} placeholder="Routenname oder Distributions-Titel" className={inputCls} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={newCampaign.city_slug} onChange={(e) => setNewCampaign((prev) => ({ ...prev, city_slug: e.target.value }))} className={inputCls}>
                      <option value="">Stadt waehlen</option>
                      {uniqueCities.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                    <input type="text" value={newCampaign.target_id} onChange={(e) => setNewCampaign((prev) => ({ ...prev, target_id: e.target.value, target_kind: "route" }))} placeholder="Route-ID oder Slug" className={inputCls} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" value={newCampaign.cta_label} onChange={(e) => setNewCampaign((prev) => ({ ...prev, cta_label: e.target.value }))} placeholder="CTA Label" className={inputCls} />
                    <input type="url" value={newCampaign.cta_url} onChange={(e) => setNewCampaign((prev) => ({ ...prev, cta_url: e.target.value }))} placeholder="https://route-ziel.de" className={inputCls} />
                  </div>
                  {addCampaignError ? <p className="text-xs text-red-600">{addCampaignError}</p> : null}
                  <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vorschau</div>
                    <div className="mt-3 rounded-[20px] border border-[var(--line-subtle)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[var(--text-strong)]">{newCampaign.name || "Route-Asset"}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{(newCampaign.city_slug || profile.primary_city_slug || "Stadt")} - {(newCampaign.target_id || "Route-ID folgt")}</div>
                        </div>
                        <AssetStatusPill label="Route" tone="active" />
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-muted)]">CTA: {newCampaign.cta_label || "Route oeffnen"} - ideal fuer Explore- oder Roadtrip-Distribution.</p>
                    </div>
                  </div>
                  <button onClick={() => void handleAddCampaign()} disabled={addingCampaign || !routeReady} className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    {addingCampaign ? "Wird angelegt..." : "Route anlegen"}
                  </button>
                </div>
              ) : null}

              {selectedAssetBuilder === "affiliate" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Affiliate-Builder</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Hinterlege ein Angebot mit Tracking, Scope und optionalem Zielobjekt.</p>
                    </div>
                    <AssetStatusPill label={affiliateReady ? "Bereit zum Start" : "Entwurf"} tone={affiliateReady ? "ready" : "draft"} />
                  </div>
                  <input type="text" value={newAffiliate.provider_name} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, provider_name: e.target.value }))} placeholder="Anbietername" className={inputCls} />
                  <input type="url" value={newAffiliate.destination_url} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, destination_url: e.target.value }))} placeholder="https://ziel-url.de" className={inputCls} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={newAffiliate.link_scope} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, link_scope: e.target.value }))} className={inputCls}>
                      {AFFILIATE_SCOPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <select value={newAffiliate.commission_model} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, commission_model: e.target.value }))} className={inputCls}>
                      {COMMISSION_MODEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                    <select value={newAffiliate.target_kind} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, target_kind: e.target.value as NewAffiliateLinkForm["target_kind"] }))} className={inputCls}>
                      <option value="none">Ohne Target</option>
                      <option value="location">Standort</option>
                      <option value="route">Route</option>
                      <option value="planner_event">Planner Event</option>
                    </select>
                    <input type="text" value={newAffiliate.target_id} onChange={(e) => setNewAffiliate((prev) => ({ ...prev, target_id: e.target.value }))} placeholder="Target-ID optional" className={inputCls} />
                  </div>
                  {addAffiliateError ? <p className="text-xs text-red-600">{addAffiliateError}</p> : null}
                  <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vorschau</div>
                    <div className="mt-3 rounded-[20px] border border-[var(--line-subtle)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[var(--text-strong)]">{newAffiliate.provider_name || "Affiliate-Angebot"}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{[newAffiliate.link_scope, newAffiliate.commission_model].join(" - ")}</div>
                        </div>
                        <AssetStatusPill label="Tracking" tone="active" />
                      </div>
                      <p className="mt-3 truncate text-sm text-[var(--text-muted)]">{newAffiliate.destination_url || "Ziel-URL folgt"}</p>
                    </div>
                  </div>
                  <button onClick={() => void handleAddAffiliateLink()} disabled={addingAffiliate || !affiliateReady} className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    {addingAffiliate ? "Wird angelegt..." : "Affiliate-Angebot anlegen"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        <Section id="visibility" title="Kennzahlen" subtitle="Letzte 30 Tage und aktuelle Revenue-Basis">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Impressionen"
              value={stats.impressions.toLocaleString("de-DE")}
              sub="Sichtbarkeit in Plaenen"
            />
            <StatTile
              label="Klicks"
              value={stats.clicks.toLocaleString("de-DE")}
              sub="auf Affiliate-Links"
            />
            <StatTile
              label="Buchungsanfragen"
              value={stats.bookings.toLocaleString("de-DE")}
              sub="via Event Planner"
            />
            <StatTile
              label="CTR / Conversion"
              value={convRate}
              sub="Klicks / Impressionen"
            />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Kampagnen</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeCampaigns.length}</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {campaigns.length > 0
                  ? `${campaigns.length} Kampagnen angelegt, ${activeCampaigns.length} davon aktiv.`
                  : "Noch keine Partner-Kampagnen hinterlegt."}
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Affiliate-Links</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeAffiliateLinks.length}</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {affiliateLinks.length > 0
                  ? `${affiliateLinks.length} Links im Bestand, ${activeAffiliateLinks.length} aktiv getrackt.`
                  : "Noch keine Affiliate- oder externen Tracking-Links angelegt."}
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Angebotsstruktur</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totalPackages}</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Pakete und Preislogiken fuer Event-Anfragen und vergleichbare Angebotsbausteine.
              </p>
            </div>
          </div>
        </Section>

        {/* ── C) Buchungsanfragen ──────────────────────────────────────────── */}
        <Section
          title="Distribution Control"
          subtitle="Verwalte deinen Live-Bestand. Neue Assets legst du oben im Asset Studio an."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedAssetBuilder("location")}
              className="inline-flex items-center rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
            >
              Standort anlegen
            </button>
            <button
              onClick={() => setSelectedAssetBuilder("event")}
              className="inline-flex items-center rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
            >
              Event anlegen
            </button>
            <button
              onClick={() => setSelectedAssetBuilder("route")}
              className="inline-flex items-center rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
            >
              Route anlegen
            </button>
            <button
              onClick={() => setSelectedAssetBuilder("affiliate")}
              className="inline-flex items-center rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
            >
              Affiliate-Angebot anlegen
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Partner-Kampagnen</div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Event-, Route- und Featured-Ausspielungen mit Status- und Laufzeitkontrolle.</p>
                </div>
                <AssetStatusPill label={`${campaigns.length} im Bestand`} tone={activeCampaigns.length > 0 ? "active" : "draft"} />
              </div>
              {campaigns.length > 0 ? (
                <div className="space-y-3">
                  {campaigns.slice(0, 6).map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-[var(--line-subtle)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-[var(--text-strong)]">{campaign.name}</div>
                            <ReviewStatusPill status={campaign.review_status} />
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {[campaign.campaign_type, campaign.city_slug ?? "ohne Stadt", formatOptionalDateRange(campaign.starts_at, campaign.ends_at)].join(" - ")}
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-strong)]">
                          {campaign.status}
                        </span>
                      </div>
                      {campaign.cta_label ? (
                        <div className="mt-2 text-xs text-[var(--text-muted)]">CTA: {campaign.cta_label}</div>
                      ) : null}
                      {campaign.review_notes ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {campaign.review_notes}
                        </div>
                      ) : null}
                      {isAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["draft", "changes_requested"].includes(campaign.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("campaign", campaign.id, "submit")}
                              disabled={reviewUpdatingKey === `campaign:${campaign.id}:submit`}
                              className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `campaign:${campaign.id}:submit` ? "..." : "Zur Freigabe senden"}
                            </button>
                          ) : null}
                          {["submitted", "in_review"].includes(campaign.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("campaign", campaign.id, "withdraw")}
                              disabled={reviewUpdatingKey === `campaign:${campaign.id}:withdraw`}
                              className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `campaign:${campaign.id}:withdraw` ? "..." : "Zurueckziehen"}
                            </button>
                          ) : null}
                          <button
                            onClick={() => void handleCampaignStatus(campaign.id, campaign.status === "active" ? "paused" : "active")}
                            disabled={campaignUpdating === campaign.id || !["approved", "published"].includes(campaign.review_status)}
                            className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                          >
                            {campaignUpdating === campaign.id ? "..." : campaign.status === "active" ? "Pausieren" : "Aktivieren"}
                          </button>
                          <button
                            onClick={() => void handleDeleteCampaign(campaign.id)}
                            disabled={deletingCampaign === campaign.id}
                            className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingCampaign === campaign.id ? "..." : "Loeschen"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
                  Noch keine Kampagnen live. Lege oben im Asset Studio dein erstes Event- oder Route-Asset an.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Affiliate- und externe Links</div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Monetarisierung nach Scope, Zielobjekt und Aktivstatus steuern.</p>
                </div>
                <AssetStatusPill label={`${affiliateLinks.length} im Bestand`} tone={activeAffiliateLinks.length > 0 ? "active" : "draft"} />
              </div>
              {affiliateLinks.length > 0 ? (
                <div className="space-y-3">
                  {affiliateLinks.slice(0, 6).map((link) => (
                    <div key={link.id} className="rounded-2xl border border-[var(--line-subtle)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-[var(--text-strong)]">{link.provider_name}</div>
                            <ReviewStatusPill status={link.review_status} />
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {[link.link_scope, link.commission_model].join(" - ")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {(affiliateClickCounts[link.id] ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                              {affiliateClickCounts[link.id]} Klick{affiliateClickCounts[link.id] !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-strong)]">
                            {link.is_active ? "aktiv" : "pausiert"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 truncate text-xs text-[var(--text-muted)]">{link.destination_url}</div>
                      {link.review_notes ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {link.review_notes}
                        </div>
                      ) : null}
                      {isAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["draft", "changes_requested"].includes(link.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("affiliate", link.id, "submit")}
                              disabled={reviewUpdatingKey === `affiliate:${link.id}:submit`}
                              className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `affiliate:${link.id}:submit` ? "..." : "Zur Freigabe senden"}
                            </button>
                          ) : null}
                          {["submitted", "in_review"].includes(link.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("affiliate", link.id, "withdraw")}
                              disabled={reviewUpdatingKey === `affiliate:${link.id}:withdraw`}
                              className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `affiliate:${link.id}:withdraw` ? "..." : "Zurueckziehen"}
                            </button>
                          ) : null}
                          <button
                            onClick={() => void handleAffiliateState(link.id, !link.is_active)}
                            disabled={affiliateUpdating === link.id || !["approved", "published"].includes(link.review_status)}
                            className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                          >
                            {affiliateUpdating === link.id ? "..." : link.is_active ? "Pausieren" : "Aktivieren"}
                          </button>
                          <button
                            onClick={() => void handleDeleteAffiliate(link.id)}
                            disabled={deletingAffiliate === link.id}
                            className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingAffiliate === link.id ? "..." : "Loeschen"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
                  Noch keine Affiliate-Links live. Lege oben dein erstes Partner-Angebot mit Tracking und Zielobjekt an.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section
          id="inquiries"
          title="Buchungsanfragen"
          subtitle={`${openBookings.length} offen`}
        >
          {bookings.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--line-subtle)] px-6 py-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Noch keine Buchungsanfragen.
              </p>
              {providers.length === 0 && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Füge zuerst deine Dienstleister hinzu, damit sie im Event Planner erscheinen.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Open requests first */}
              {openBookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isAdmin={isAdmin}
                  updating={bookingUpdating === booking.id}
                  onConfirm={() => void handleBookingStatus(booking.id, "confirmed")}
                  onDecline={() => void handleBookingStatus(booking.id, "declined")}
                />
              ))}
              {/* Separator */}
              {openBookings.length > 0 && pastBookings.length > 0 && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--line-subtle)]" />
                  <span className="text-xs text-[var(--text-muted)]">Abgeschlossen</span>
                  <div className="h-px flex-1 bg-[var(--line-subtle)]" />
                </div>
              )}
              {pastBookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isAdmin={false}
                  updating={false}
                  onConfirm={() => {}}
                  onDecline={() => {}}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── D0) Typ-spezifische Details ──────────────────────────────────── */}
        <TypeSpecificSection profile={profile} userId={userId} onProfileChange={setProfile} />

        {/* ── D1) Dienstleister & Pakete ───────────────────────────────────── */}
        <Section
          id="assets"
          title="Assets und Angebote"
          subtitle="Deine Event-Planner-Eintraege, Pakete und ersten buchbaren Bausteine."
          action={
            isAdmin ? (
              <span className="inline-flex items-center rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
                {providers.length} Angebote - {totalPackages} Pakete
              </span>
            ) : null
          }
        >
          {/* Provider list */}
          {providers.length > 0 && (
            <div className="mb-4 space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
                  {/* Provider header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--text-strong)]">{provider.name}</span>
                        {provider.is_verified && (
                          <span className="rounded-full bg-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>
                        )}
                        <ReviewStatusPill status={provider.review_status} />
                        <span className="rounded-full border border-[var(--line-subtle)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                          {SERVICE_TYPE_LABEL[provider.service_type] ?? provider.service_type}
                        </span>
                      </div>
                      {provider.description && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{provider.description}</p>
                      )}
                      {provider.review_notes ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {provider.review_notes}
                        </div>
                      ) : null}
                      {isAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["draft", "changes_requested"].includes(provider.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("provider", provider.id, "submit")}
                              disabled={reviewUpdatingKey === `provider:${provider.id}:submit`}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `provider:${provider.id}:submit` ? "..." : "Zur Freigabe senden"}
                            </button>
                          ) : null}
                          {["submitted", "in_review"].includes(provider.review_status) ? (
                            <button
                              onClick={() => void handleReviewAction("provider", provider.id, "withdraw")}
                              disabled={reviewUpdatingKey === `provider:${provider.id}:withdraw`}
                              className="rounded-xl border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] disabled:opacity-50"
                            >
                              {reviewUpdatingKey === `provider:${provider.id}:withdraw` ? "..." : "Zurueckziehen"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => void handleDeleteProvider(provider.id)}
                        disabled={deletingProvider === provider.id}
                        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingProvider === provider.id ? "…" : "Löschen"}
                      </button>
                    )}
                  </div>

                  {/* Packages */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Pakete ({provider.provider_packages.length})
                    </p>
                    {provider.provider_packages.length > 0 && (
                      <div className="mb-3 grid gap-2 sm:grid-cols-2">
                        {provider.provider_packages.map((pkg) => (
                          <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--text-strong)]">{pkg.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {PRICE_UNIT_LABEL[pkg.price_unit] ?? pkg.price_unit}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-semibold text-[var(--text-strong)]">
                                {formatPrice(pkg.price_cents, pkg.price_unit)}
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => void handleDeletePackage(provider.id, pkg.id)}
                                  disabled={deletingPkg === pkg.id}
                                  className="rounded-lg px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                                  title="Paket löschen"
                                >
                                  {deletingPkg === pkg.id ? "…" : "×"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add package form or button */}
                    {isAdmin && addPkgFor === provider.id ? (
                      <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Neues Paket</p>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Paket-Name (z.B. Basis-Paket)"
                            value={newPkg.name}
                            onChange={(e) => setNewPkg((f) => ({ ...f, name: e.target.value }))}
                            className={inputCls}
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="text"
                              placeholder="Preis in € (z.B. 499)"
                              value={newPkg.price}
                              onChange={(e) => setNewPkg((f) => ({ ...f, price: e.target.value }))}
                              className={inputCls}
                            />
                            <select
                              value={newPkg.price_unit}
                              onChange={(e) => setNewPkg((f) => ({ ...f, price_unit: e.target.value }))}
                              className={inputCls}
                            >
                              {Object.entries(PRICE_UNIT_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Kurzbeschreibung (optional)"
                            value={newPkg.description}
                            onChange={(e) => setNewPkg((f) => ({ ...f, description: e.target.value }))}
                            className={inputCls}
                          />
                          <textarea
                            placeholder={"Leistungen (eine pro Zeile):\nz.B. 8 Stunden\nBildergalerie online\nGedrucktes Album"}
                            value={newPkg.includes}
                            onChange={(e) => setNewPkg((f) => ({ ...f, includes: e.target.value }))}
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="number"
                              placeholder="Min. Personen (opt.)"
                              value={newPkg.min_guests}
                              onChange={(e) => setNewPkg((f) => ({ ...f, min_guests: e.target.value }))}
                              className={inputCls}
                            />
                            <input
                              type="number"
                              placeholder="Max. Personen (opt.)"
                              value={newPkg.max_guests}
                              onChange={(e) => setNewPkg((f) => ({ ...f, max_guests: e.target.value }))}
                              className={inputCls}
                            />
                          </div>
                          {addPkgError && <p className="text-xs text-red-600">{addPkgError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleAddPackage(provider.id)}
                              disabled={addingPkg || !newPkg.name.trim() || !newPkg.price}
                              className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                            >
                              {addingPkg ? "Speichern …" : "Paket speichern"}
                            </button>
                            <button
                              onClick={() => { setAddPkgFor(null); setAddPkgError(null); }}
                              className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : isAdmin ? (
                      <button
                        onClick={() => { setAddPkgFor(provider.id); setAddPkgError(null); setNewPkg({ name: "", price: "", price_unit: "total", description: "", includes: "", min_guests: "", max_guests: "" }); }}
                        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-[var(--line-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
                      >
                        + Paket hinzufügen
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add provider form */}
          {isAdmin && showAddProvider ? (
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-strong)]">Neues Angebot eintragen</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Anzeigename (z.B. Max Muster Fotografie)"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={newProvider.service_type}
                    onChange={(e) => setNewProvider((f) => ({ ...f, service_type: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Kategorie wählen …</option>
                    {getAvailableServiceTypes(profile).map((t) => (
                      <option key={t} value={t}>{SERVICE_TYPE_LABEL[t] ?? t}</option>
                    ))}
                  </select>
                  <select
                    value={newProvider.city_slug}
                    onChange={(e) => setNewProvider((f) => ({ ...f, city_slug: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Hauptstadt wählen …</option>
                    {Array.from(new Set([profile.primary_city_slug, ...(profile.operating_cities ?? [])].filter(Boolean))).map((slug) => (
                      <option key={slug} value={slug!}>{slug}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Kurzbeschreibung (optional)"
                  value={newProvider.description}
                  onChange={(e) => setNewProvider((f) => ({ ...f, description: e.target.value }))}
                  className={inputCls}
                />
                {addProviderError && <p className="text-xs text-red-600">{addProviderError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleAddProvider()}
                    disabled={addingProvider || !newProvider.name.trim() || !newProvider.service_type || !newProvider.city_slug}
                    className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {addingProvider ? "Wird angelegt …" : "Angebot anlegen"}
                  </button>
                  <button
                    onClick={() => { setShowAddProvider(false); setAddProviderError(null); }}
                    className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : isAdmin ? (
            <button
              onClick={() => {
                setShowAddProvider(true);
                setAddProviderError(null);
                setNewProvider({
                  name: profile.display_name,
                  service_type: getAvailableServiceTypes(profile)[0] ?? "",
                  city_slug: profile.primary_city_slug ?? "",
                  description: "",
                });
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-[var(--line-subtle)] px-5 py-3 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
            >
              + Angebot im Event Planner hinzufügen
            </button>
          ) : (
            providers.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-[var(--line-subtle)] px-6 py-10 text-center">
                <p className="text-sm text-[var(--text-muted)]">Noch keine Angebote eingetragen.</p>
              </div>
            )
          )}
        </Section>

        {/* ── D2) Profil-Einstellungen ─────────────────────────────────────── */}
        <Section id="profile" title="Profil-Einstellungen" subtitle="Basisdaten, Kontaktwege und redaktionelle Profilqualitaet.">
          {editMode ? (
            <div className="space-y-4">
              <InputField
                label="Anzeigename"
                value={editForm.display_name}
                onChange={(v) => setEditForm((f) => ({ ...f, display_name: v }))}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Website"
                  value={editForm.website_url}
                  onChange={(v) => setEditForm((f) => ({ ...f, website_url: v }))}
                  placeholder="https://example.com"
                />
                <InputField
                  label="Buchungs-URL"
                  value={editForm.booking_url}
                  onChange={(v) => setEditForm((f) => ({ ...f, booking_url: v }))}
                  placeholder="https://buchung.example.com"
                />
                <InputField
                  label="E-Mail"
                  value={editForm.contact_email}
                  onChange={(v) => setEditForm((f) => ({ ...f, contact_email: v }))}
                  placeholder="kontakt@example.com"
                />
                <InputField
                  label="Telefon"
                  value={editForm.contact_phone}
                  onChange={(v) => setEditForm((f) => ({ ...f, contact_phone: v }))}
                  placeholder="+49 30 …"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Interne Notizen
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={saving}
                  className="inline-flex items-center rounded-xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Speichern …" : "Speichern"}
                </button>
                <button
                  onClick={() => { setEditMode(false); setSaveError(null); }}
                  className="inline-flex items-center rounded-xl border border-[var(--line-subtle)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ProfileRow label="Anzeigename" value={profile.display_name} />
              <ProfileRow label="Typ" value={PARTNER_TYPE_LABEL[profile.partner_type] ?? profile.partner_type} />
              <ProfileRow label="Stadt" value={profile.primary_city_slug ?? "—"} />
              <ProfileRow label="Website" value={profile.website_url ?? "—"} />
              <ProfileRow label="Buchungs-URL" value={profile.booking_url ?? "—"} />
              <ProfileRow label="E-Mail" value={profile.contact_email ?? "—"} />
              <ProfileRow label="Telefon" value={profile.contact_phone ?? "—"} />
              {profile.notes && <ProfileRow label="Notizen" value={profile.notes} />}
              {isAdmin && (
                <button
                  onClick={() => setEditMode(true)}
                  className="mt-2 inline-flex items-center rounded-xl border border-[var(--line-subtle)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
                >
                  Bearbeiten
                </button>
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function BookingRow({
  booking, isAdmin, updating, onConfirm, onDecline,
}: {
  booking: BookingRequest;
  isAdmin: boolean;
  updating: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const meta = BOOKING_STATUS[booking.status] ?? BOOKING_STATUS.interested;
  const isOpen = booking.status === "interested" || booking.status === "pending";

  return (
    <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-strong)]">
              {booking.event_plans?.title ?? "Unbenannter Plan"}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {NEED_LABEL[booking.need_slug] ?? booking.need_slug}
            {booking.service_providers?.name ? ` · ${booking.service_providers.name}` : ""}
            {booking.provider_packages?.name ? ` · ${booking.provider_packages.name}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            {booking.event_plans?.guest_count && (
              <span>{booking.event_plans.guest_count} Gäste</span>
            )}
            {booking.event_plans?.event_date && (
              <span>{formatDate(booking.event_plans.event_date)}</span>
            )}
            <span>{(booking.price_cents_agreed / 100).toLocaleString("de-DE")} €</span>
            <span>{formatDate(booking.created_at)}</span>
          </div>
        </div>

        {isAdmin && isOpen && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onConfirm}
              disabled={updating}
              className="inline-flex items-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {updating ? "…" : "Bestätigen"}
            </button>
            <button
              onClick={onDecline}
              disabled={updating}
              className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {updating ? "…" : "Ablehnen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <span className="min-w-0 break-all text-sm text-[var(--text-strong)]">{value}</span>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none";

function InputField({
  label, value, onChange, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}{required && " *"}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
      />
    </div>
  );
}

function TypeSpecificSection({
  profile,
  userId,
  onProfileChange,
}: {
  profile: PartnerProfile;
  userId: string | null;
  onProfileChange: (p: PartnerProfile) => void;
}) {
  const typeSlug = profile.partner_type_slug ?? "other";
  const hasTypeData = Object.keys(profile.type_data ?? {}).some((k) => (profile.type_data ?? {})[k]);
  const hasCategories = (profile.service_category_slugs ?? []).length > 0;
  const hasCities = (profile.operating_cities ?? []).length > 0;

  const [mediaUrls, setMediaUrls] = useState<string[]>(profile.media_urls ?? []);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaSaveError, setMediaSaveError] = useState<string | null>(null);
  const [mediaSaved, setMediaSaved] = useState(false);

  const mediaDirty = JSON.stringify(mediaUrls) !== JSON.stringify(profile.media_urls ?? []);
  const mediaPreviewItems = mediaUrls
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url, index) => ({
      id: `${profile.id}-media-${index}`,
      url,
      alt: profile.display_name,
      caption: index === 0 ? `${profile.display_name} · Titelbild` : `${profile.display_name} · Galerie`,
      creditName: null,
      sourceLabel: index === 0 ? "Partner-Cover" : "Partner-Galerie",
      badge: index === 0 ? "Cover" : "Galerie",
    }));

  async function saveMedia() {
    setMediaSaving(true);
    setMediaSaveError(null);
    const { error } = await supabase
      .from("partner_profiles")
      .update({ media_urls: mediaUrls })
      .eq("id", profile.id);
    setMediaSaving(false);
    if (error) {
      setMediaSaveError(error.message);
    } else {
      onProfileChange({ ...profile, media_urls: mediaUrls });
      setMediaSaved(true);
      setTimeout(() => setMediaSaved(false), 2000);
    }
  }

  if (!hasTypeData && !hasCategories && !hasCities && mediaUrls.length === 0) return null;

  return (
    <Section
      title={PARTNER_TYPE_SLUG_LABEL[typeSlug] ?? typeSlug}
      subtitle="Profil-Details aus dem Onboarding"
    >
      <div className="space-y-5">
        {/* Media management */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Fotos</p>
          <PhotoUpload
            folder={userId ?? "anon"}
            value={mediaUrls}
            onChange={setMediaUrls}
            maxPhotos={5}
          />
          {mediaDirty && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={saveMedia}
                disabled={mediaSaving}
                className="rounded-full bg-[var(--text-strong)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-80 disabled:opacity-50"
              >
                {mediaSaving ? "Speichern …" : "Fotos speichern"}
              </button>
              {mediaSaveError && <p className="text-xs text-red-600">{mediaSaveError}</p>}
            </div>
          )}
          {mediaSaved && (
            <p className="mt-2 text-xs text-[var(--brand-accent)]">Gespeichert</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
              Erstes Foto = Titelbild fuer Profil und bevorzugtes Fallback-Cover.
            </div>
            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
              Weitere Bilder staerken Galerie, Event-Anbieter-Karten und redaktionelle Empfehlungen.
            </div>
            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
              Spaeter koennen freigegebene Community- und Creator-Bilder zusaetzlich als Featured-Medien genutzt werden.
            </div>
          </div>

          <div className="mt-4">
            <EntityMediaGallery
              title="Medienvorschau"
              subtitle="So wirken Cover und Galerie fuer dein Profil aktuell im Frontend."
              items={mediaPreviewItems}
              emptyTitle="Noch keine Partner-Bilder"
              emptyBody="Lade mindestens ein Coverbild hoch, damit dein Profil, deine Anbieterkarte und kuenftige Event-Module hochwertig wirken."
              rightsHint="Partner-Medien koennen spaeter in Profil, Event-Anbieterflaechen und weiteren Discovery-Modulen ausgespielt werden."
            />
          </div>
        </div>

        {/* Type-data key/values */}
        {hasTypeData && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Kennzahlen</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(profile.type_data ?? {})
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="rounded-[18px] border border-[var(--line-subtle)] bg-white px-4 py-3">
                    <p className="text-[11px] text-[var(--text-muted)]">{TYPE_DATA_LABELS[k] ?? k}</p>
                    <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{v}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {hasCategories && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Kategorien</p>
            <div className="flex flex-wrap gap-2">
              {(profile.service_category_slugs ?? []).map((slug) => (
                <span
                  key={slug}
                  className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-strong)]"
                >
                  {slug}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Operating cities */}
        {hasCities && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Einsatzstädte</p>
            <div className="flex flex-wrap gap-2">
              {(profile.operating_cities ?? []).map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-strong)]"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Booking type */}
        {profile.booking_type && profile.booking_type !== "request" && (
          <div className="flex items-baseline gap-4">
            <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Buchungsart
            </span>
            <span className="text-sm text-[var(--text-strong)]">
              {BOOKING_TYPE_LABEL[profile.booking_type] ?? profile.booking_type}
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}
