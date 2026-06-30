export type MonetizationHorizon =
  | "short_term"
  | "medium_term"
  | "later"
  | "long_term";

export type MonetizationRevenueLayer =
  | "transaction"
  | "visibility"
  | "recurring"
  | "consumer"
  | "strategic";

export type MonetizationBillingModel =
  | "cpa"
  | "cps"
  | "cpl"
  | "cpc"
  | "fixed_monthly"
  | "fixed_weekly"
  | "campaign"
  | "license"
  | "hybrid"
  | "entitlement";

export type PartnerType =
  | "restaurant"
  | "venue"
  | "organizer"
  | "ticketing"
  | "experience"
  | "tourism"
  | "publisher"
  | "brand"
  | "creator_agency"
  | "other";

export type PartnerVisibilityTier =
  | "organic"
  | "featured"
  | "partner_basic"
  | "partner_pro"
  | "city_pro_plus"
  | "strategic";

export type PartnerCampaignType =
  | "featured_event"
  | "featured_location"
  | "sponsored_placement"
  | "city_spotlight"
  | "creator_distribution"
  | "white_label"
  | "insights";

export type SponsoredSurface =
  | "planner"
  | "explore"
  | "route_detail"
  | "location_detail"
  | "event_detail"
  | "shared_plan"
  | "creator_profile"
  | "city_spotlight"
  | "roadtrip";

export type SponsoredSlotType =
  | "featured_event"
  | "featured_location"
  | "sponsored_placement"
  | "city_spotlight"
  | "creator_distribution";

export type AttributionEventType =
  | "impression"
  | "click"
  | "redirect"
  | "lead"
  | "conversion"
  | "plan_intent"
  | "plan_save"
  | "share_activation"
  | "group_confirmation"
  | "route_copy"
  | "route_view"
  | "route_publish"
  | "creator_follow"
  | "ai_plan_open"
  | "ai_plan_generated"
  | "ai_plan_applied"
  | "ai_plan_exited";

export type CreatorRewardType =
  | "distribution_credit"
  | "campaign_credit"
  | "boost_credit"
  | "featured_slot"
  | "cash_pending"
  | "cash_paid"
  | "performance_bonus"
  | "referral_bonus";

export type CreatorRewardSourceType =
  | "route_copy"
  | "share_activation"
  | "plan_activation"
  | "affiliate_conversion"
  | "partner_campaign"
  | "editor_pick"
  | "manual";

export type MonetizationProductKey =
  | "affiliate_events"
  | "affiliate_experiences"
  | "affiliate_restaurants"
  | "affiliate_tourism"
  | "affiliate_hotels"
  | "featured_event"
  | "featured_location"
  | "sponsored_placement"
  | "city_spotlight"
  | "partner_basic"
  | "partner_pro"
  | "city_pro_plus"
  | "creator_brand_route_distribution"
  | "b2c_premium"
  | "white_label_city_guide"
  | "media_widget"
  | "demand_insights";

export type MonetizationEntitlementKey =
  | "unlimited_saved_plans"
  | "advanced_group_collab"
  | "premium_plan_variants"
  | "creator_distribution_tools"
  | "creator_reward_pool"
  | "partner_featured_visibility"
  | "partner_reporting"
  | "white_label_access"
  | "insights_exports";

export type SponsoredSlotKey =
  | "planner_featured_event_module"
  | "planner_featured_location_module"
  | "explore_featured_events_strip"
  | "explore_featured_locations_strip"
  | "route_detail_brand_distribution"
  | "location_detail_partner_spotlight"
  | "event_detail_partner_spotlight"
  | "shared_plan_partner_cta"
  | "creator_profile_featured_routes"
  | "city_spotlight_seasonal"
  | "roadtrip_hotel_search";

export type MonetizationProductDefinition = {
  key: MonetizationProductKey;
  label: string;
  horizon: MonetizationHorizon;
  revenueLayer: MonetizationRevenueLayer;
  billingModel: MonetizationBillingModel;
  targetType: string;
  linkedEntitlementKey?: MonetizationEntitlementKey | null;
  notes?: string;
};

export type SponsoredSlotDefinition = {
  key: SponsoredSlotKey;
  surface: SponsoredSurface;
  slotType: SponsoredSlotType;
  disclosureLabel: string;
  defaultStatus: "draft" | "inactive" | "active";
  maxPositions: number;
  notes?: string;
};

export type MonetizationEntitlementDefinition = {
  key: MonetizationEntitlementKey;
  layer: "consumer" | "creator" | "partner" | "strategic";
  defaultState: "off" | "beta" | "active";
  description: string;
};
