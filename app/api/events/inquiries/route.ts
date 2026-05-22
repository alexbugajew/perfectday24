import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OCCASION_LABELS: Record<string, string> = {
  geburtstag:       "Geburtstag",
  hochzeit:         "Hochzeit",
  teambuilding:     "Teambuilding",
  firmenfeier:      "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz:        "Konferenz",
  jubilaeum:        "Jubiläum",
  staedtereise:     "Städtereise",
};

const NEED_LABEL: Record<string, string> = {
  location:   "Location",
  catering:   "Catering",
  musik:      "Musik / DJ",
  deko:       "Dekoration",
  florist:    "Florist",
  fotografie: "Fotografie",
  video:      "Videografie",
  moderation: "Moderation",
  animation:  "Animation / Aktivität",
  torte:      "Torte",
  technik:    "Technik / AV",
  transport:  "Transport",
};

type ProviderEntry = {
  id: string;
  needSlug: string;
  email: string | null;
  name: string;
};

type EventData = {
  date: string;
  city: string;
  cityName: string;
  guests: number;
  budget: number;
  occasion: string;
  planTitle: string;
  customerMessage?: string;
};

async function sendVendorEmail(opts: {
  to: string;
  vendorName: string;
  needLabel: string;
  quoteToken: string;
  eventData: EventData;
  planUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // email is optional — DB records are the source of truth

  const { to, vendorName, needLabel, quoteToken, eventData } = opts;
  const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://perfectday24.de"}/vendor/quote/${quoteToken}`;
  const occasionLabel = OCCASION_LABELS[eventData.occasion] ?? eventData.occasion;

  const dateFormatted = eventData.date
    ? new Date(eventData.date).toLocaleDateString("de-DE", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Datum offen";

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Preisanfrage via PerfectDay24</title></head>
<body style="font-family:system-ui,sans-serif;background:#f7f4ee;margin:0;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto;background:#fffdf8;border-radius:20px;padding:32px;border:1px solid rgba(23,23,23,0.08)">

    <div style="font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#b76a43;margin-bottom:8px">
      PerfectDay24 · Neue Preisanfrage
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#171717">
      Preisanfrage: ${needLabel}
    </h1>
    <p style="color:#665d55;margin:0 0 24px;font-size:14px">
      Jemand plant einen <strong>${occasionLabel}</strong> und ist an Ihrem Angebot interessiert.
    </p>

    <div style="background:#f0ede7;border-radius:12px;padding:16px 20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="color:#8b7767;padding:4px 0;width:40%">Event</td>
          <td style="color:#171717;font-weight:600">${eventData.planTitle || occasionLabel}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Anlass</td>
          <td style="color:#171717">${occasionLabel}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Datum</td>
          <td style="color:#171717">${dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Ort</td>
          <td style="color:#171717">${eventData.cityName || eventData.city}</td>
        </tr>
        ${eventData.guests > 0 ? `
        <tr>
          <td style="color:#8b7767;padding:4px 0">Gäste</td>
          <td style="color:#171717">${eventData.guests} Personen</td>
        </tr>` : ""}
        ${eventData.budget > 0 ? `
        <tr>
          <td style="color:#8b7767;padding:4px 0">Budget gesamt</td>
          <td style="color:#171717">ca. ${eventData.budget.toLocaleString("de-DE")} €</td>
        </tr>` : ""}
        ${eventData.customerMessage ? `
        <tr>
          <td style="color:#8b7767;padding:4px 0;vertical-align:top">Nachricht</td>
          <td style="color:#171717">${eventData.customerMessage}</td>
        </tr>` : ""}
      </table>
    </div>

    <p style="font-size:13px;color:#665d55;margin:0 0 20px">
      Geben Sie über den folgenden Link direkt auf PerfectDay24 Ihr Angebot ein —
      der Interessent wird sofort benachrichtigt.
    </p>

    <a href="${quoteUrl}"
       style="display:inline-block;background:#171717;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600">
      Angebot abgeben →
    </a>

    <p style="margin:24px 0 0;font-size:12px;color:#8b7767">
      Dieser Link ist 30 Tage gültig. Sie benötigen kein Konto auf PerfectDay24.<br>
      Bei Fragen: <a href="mailto:partner@perfectday24.de" style="color:#b76a43">partner@perfectday24.de</a>
    </p>
  </div>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PerfectDay24 <anfragen@perfectday24.de>",
      reply_to: `anfrage+${quoteToken}@perfectday24.de`,
      to: [to],
      subject: `Preisanfrage für ${needLabel} — ${OCCASION_LABELS[eventData.occasion] ?? eventData.occasion} am ${dateFormatted}`,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Auth: get user from session cookie
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const body = await req.json() as {
    planId: string;
    providers: ProviderEntry[];
    eventData: EventData;
  };

  const { planId, providers, eventData } = body;

  if (!planId || !providers?.length) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Verify the plan belongs to this user
  const { data: plan, error: planErr } = await admin
    .from("event_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (planErr || !plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  // Create inquiry
  const { data: inquiry, error: inquiryErr } = await admin
    .from("event_inquiries")
    .insert({
      event_plan_id:    planId,
      customer_id:      user.id,
      status:           "sent",
      occasion_slug:    eventData.occasion,
      city_slug:        eventData.city,
      event_date:       eventData.date || null,
      guest_count:      eventData.guests || null,
      budget_cents:     eventData.budget ? eventData.budget * 100 : null,
      customer_message: eventData.customerMessage || null,
      sent_at:          new Date().toISOString(),
    })
    .select("id")
    .single();

  if (inquiryErr || !inquiry) {
    console.error("inquiry insert failed:", inquiryErr?.message);
    return NextResponse.json({ error: "inquiry_create_failed" }, { status: 500 });
  }

  // Create vendor_quotes + send emails
  const quoteRows = providers.map((p) => ({
    inquiry_id:  inquiry.id,
    provider_id: p.id,
    need_slug:   p.needSlug,
    status:      "pending",
  }));

  const { data: quotes, error: quotesErr } = await admin
    .from("vendor_quotes")
    .insert(quoteRows)
    .select("id, token, need_slug, provider_id");

  if (quotesErr) {
    console.error("vendor_quotes insert failed:", quotesErr.message);
    return NextResponse.json({ error: "quotes_create_failed" }, { status: 500 });
  }

  // Send emails (fire-and-forget, don't block response)
  const emailPromises = (quotes ?? []).map(async (quote) => {
    const provider = providers.find((p) => p.id === quote.provider_id);
    if (!provider?.email) return;
    try {
      await sendVendorEmail({
        to:          provider.email,
        vendorName:  provider.name,
        needLabel:   NEED_LABEL[quote.need_slug ?? ""] ?? quote.need_slug ?? "Leistung",
        quoteToken:  quote.token,
        eventData,
        planUrl:     `${process.env.NEXT_PUBLIC_APP_URL ?? "https://perfectday24.de"}/events/plan/${planId}`,
      });
    } catch (e) {
      console.error("email send failed for provider", provider.id, e);
    }
  });

  void Promise.allSettled(emailPromises);

  return NextResponse.json({
    ok: true,
    inquiryId:  inquiry.id,
    quoteCount: quotes?.length ?? 0,
  });
}
