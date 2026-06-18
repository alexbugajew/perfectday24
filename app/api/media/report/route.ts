import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const MEDIA_REPORT_REASONS = ["copyright", "irrelevant", "offensive", "duplicate", "privacy", "other"] as const;
const BLOCKING_REPORT_STATUSES = ["open", "reviewing", "resolved"] as const;
const HIGH_PRIORITY_REPORT_REASONS = ["copyright", "privacy", "offensive"] as const;
const AUTO_HOLD_REASONS = ["copyright", "privacy"] as const;

type MediaReportReason = (typeof MEDIA_REPORT_REASONS)[number];

function isMediaReportReason(value: unknown): value is MediaReportReason {
  return typeof value === "string" && MEDIA_REPORT_REASONS.includes(value as MediaReportReason);
}

function isHighPriorityReason(reason: MediaReportReason) {
  return HIGH_PRIORITY_REPORT_REASONS.includes(reason as (typeof HIGH_PRIORITY_REPORT_REASONS)[number]);
}

function shouldAutoHoldReason(reason: MediaReportReason) {
  return AUTO_HOLD_REASONS.includes(reason as (typeof AUTO_HOLD_REASONS)[number]);
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Read-only during some server renders; safe to ignore here.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Bitte melde dich an, um ein Bild zu melden." }, { status: 401 });
    }

    const body = (await req.json()) as {
      assetId?: string;
      reason?: string;
      note?: string | null;
    };

    const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!assetId) {
      return NextResponse.json({ error: "assetId fehlt." }, { status: 400 });
    }

    if (!isMediaReportReason(body.reason)) {
      return NextResponse.json({ error: "ungueltiger Meldegrund." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, moderation_status, visibility")
      .eq("id", assetId)
      .maybeSingle();

    if (assetError) throw assetError;
    if (!asset) {
      return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
    }

    const { data: existingReport, error: existingReportError } = await supabase
      .from("media_reports")
      .select("id, status, created_at")
      .eq("asset_id", assetId)
      .eq("reported_by_user_id", user.id)
      .in("status", [...BLOCKING_REPORT_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReportError) throw existingReportError;

    if (existingReport) {
      return NextResponse.json(
        {
          error: "Du hast dieses Bild bereits gemeldet. Deine bestehende Meldung ist bereits in der Pruefung oder abgeschlossen.",
        },
        { status: 409 }
      );
    }

    const { data: activeReports, error: activeReportsError } = await supabase
      .from("media_reports")
      .select("reported_by_user_id")
      .eq("asset_id", assetId)
      .in("status", ["open", "reviewing"]);

    if (activeReportsError) throw activeReportsError;

    const distinctReporterIds = new Set(
      (activeReports ?? [])
        .map((report) => report.reported_by_user_id)
        .filter((value): value is string => Boolean(value))
    );
    distinctReporterIds.add(user.id);

    const initialStatus = isHighPriorityReason(body.reason) ? "reviewing" : "open";

    const { error: insertError } = await supabase.from("media_reports").insert({
      asset_id: assetId,
      reported_by_user_id: user.id,
      reason: body.reason,
      note: note || null,
      status: initialStatus,
    });

    if (insertError) throw insertError;

    const shouldAutoHold =
      shouldAutoHoldReason(body.reason) || distinctReporterIds.size >= 2;

    if (
      shouldAutoHold &&
      asset.visibility === "public" &&
      (asset.moderation_status === "approved" || asset.moderation_status === "featured")
    ) {
      const { error: holdError } = await supabase
        .from("media_assets")
        .update({
          moderation_status: "submitted",
          visibility: "private",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetId);

      if (holdError) throw holdError;

      const holdReason =
        body.reason === "privacy"
          ? "Auto Safety Hold: Privatsphaeren-Meldung eingegangen."
          : body.reason === "copyright"
            ? "Auto Safety Hold: Copyright-Meldung eingegangen."
            : "Auto Safety Hold: Mehrere unabhaengige Meldungen eingegangen.";

      const { error: eventError } = await supabase.from("media_moderation_events").insert({
        asset_id: assetId,
        acted_by_user_id: null,
        action: "submitted",
        note: holdReason,
      });

      if (eventError) throw eventError;

      const { error: reportStatusError } = await supabase
        .from("media_reports")
        .update({ status: "reviewing", updated_at: new Date().toISOString() })
        .eq("asset_id", assetId)
        .in("status", ["open", "reviewing"]);

      if (reportStatusError) throw reportStatusError;

      return NextResponse.json({
        ok: true,
        reviewStatus: "reviewing",
        autoHeld: true,
        message: holdReason,
      });
    }

    return NextResponse.json({
      ok: true,
      reviewStatus: initialStatus,
      autoHeld: false,
    });
  } catch (error) {
    console.error("media report submit failed:", error);
    const message = error instanceof Error ? error.message : "Die Meldung konnte nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
