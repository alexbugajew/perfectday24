"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PhotoUpload } from "@/components/ui/PhotoUpload";

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
};

type ServiceProvider = {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  is_verified: boolean;
  status: string;
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

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-[var(--text-strong)]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  const [stats, setStats] = useState<Stats>({ impressions: 0, clicks: 0, bookings: 0 });
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);

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

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
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
          service_category_slugs, operating_cities, media_urls, type_data, booking_type
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipErr || !membership || !membership.partner_profiles) {
      setNoAccess(true);
      setLoading(false);
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

    // Load stats in parallel
    const [
      { count: impressionCount },
      { count: clickCount },
      providersResult,
    ] = await Promise.all([
      supabase
        .from("partner_impressions")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", prof.id)
        .gte("created_at", since30d),
      supabase
        .from("partner_clicks")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", prof.id)
        .gte("created_at", since30d),
      supabase
        .from("service_providers")
        .select(`
          id, name, service_type, description, is_verified, status,
          provider_packages ( id, name, price_cents, price_unit, status )
        `)
        .eq("partner_profile_id", prof.id)
        .eq("status", "active"),
    ]);

    const providerList = (providersResult.data ?? []) as unknown as ServiceProvider[];
    setProviders(providerList);

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

    setLoading(false);
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

  if (noAccess || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-semibold text-[var(--text-strong)]">Kein Partner-Profil gefunden</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Du bist noch keinem Partner-Profil zugeordnet.
        </p>
        <a
          href="/partner/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── A) Status Header ─────────────────────────────────────────────────── */}
      <div className="mb-8 rounded-[36px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-7 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="pd24-kicker mb-1">Partner-Dashboard</div>
            <h1 className="truncate text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
              {profile.display_name}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {PARTNER_TYPE_LABEL[profile.partner_type] ?? profile.partner_type}
              {profile.primary_city_slug ? ` · ${profile.primary_city_slug}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tierMeta.badge}`}>
                {tierMeta.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${billingMeta.badge}`}>
                {billingMeta.label}
              </span>
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
      </div>

      <div className="space-y-6">

        {/* ── B) KPIs ──────────────────────────────────────────────────────── */}
        <Section title="Kennzahlen" subtitle="Letzte 30 Tage">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Impressionen"
              value={stats.impressions.toLocaleString("de-DE")}
              sub="Sichtbarkeit in Plänen"
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
              label="Conversion Rate"
              value={convRate}
              sub="Klicks / Impressionen"
            />
          </div>
        </Section>

        {/* ── C) Buchungsanfragen ──────────────────────────────────────────── */}
        <Section
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
          title="Angebote im Event Planner"
          subtitle="Deine Einträge erscheinen automatisch wenn Nutzer passende Events planen."
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
                        <span className="rounded-full border border-[var(--line-subtle)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                          {SERVICE_TYPE_LABEL[provider.service_type] ?? provider.service_type}
                        </span>
                      </div>
                      {provider.description && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{provider.description}</p>
                      )}
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
        <Section title="Profil-Einstellungen">
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
