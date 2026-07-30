import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { escapeHtml, escapeHtmlMultiline } from "@/lib/security/html";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

/** Obergrenze für Empfänger pro Anfrage — begrenzt Mail-Missbrauch. */
const MAX_PROVIDERS_PER_INQUIRY = 12;
/** Freitext des Kunden, der in die Vendor-Mail übernommen wird. */
const MAX_CUSTOMER_MESSAGE_LENGTH = 2000;

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

/**
 * Was der Client schicken darf. `email` und `name` werden bewusst **nicht**
 * übernommen — beide werden serverseitig aus `service_providers` geladen,
 * sonst wäre die Route ein offener Mail-Relay.
 */
type ProviderEntry = {
  id: string;
  needSlug: string;
};

/** Serverseitig aus der DB aufgelöster Anbieter. */
type ResolvedProvider = {
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

function createQuoteToken() {
  return randomBytes(18).toString("base64url");
}

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

  const { to, needLabel, quoteToken, eventData } = opts;
  const quoteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://perfectday24.de"}/vendor/quote/${encodeURIComponent(quoteToken)}`;
  const occasionLabel = OCCASION_LABELS[eventData.occasion] ?? eventData.occasion;

  const dateFormatted = eventData.date
    ? new Date(eventData.date).toLocaleDateString("de-DE", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Datum offen";

  // Alles, was aus Nutzereingaben stammt, wird escaped. Zahlen und die
  // Label-Maps sind unkritisch, werden aber der Einheitlichkeit wegen
  // gleich behandelt.
  const safeOccasion = escapeHtml(occasionLabel);
  const safeNeedLabel = escapeHtml(needLabel);
  const safeDate = escapeHtml(dateFormatted);
  const safePlanTitle = escapeHtml(eventData.planTitle || occasionLabel);
  const safeCity = escapeHtml(eventData.cityName || eventData.city);
  const safeMessage = eventData.customerMessage
    ? escapeHtmlMultiline(eventData.customerMessage, MAX_CUSTOMER_MESSAGE_LENGTH)
    : "";

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
      Preisanfrage: ${safeNeedLabel}
    </h1>
    <p style="color:#665d55;margin:0 0 24px;font-size:14px">
      Jemand plant einen <strong>${safeOccasion}</strong> und ist an Ihrem Angebot interessiert.
    </p>

    <div style="background:#f0ede7;border-radius:12px;padding:16px 20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="color:#8b7767;padding:4px 0;width:40%">Event</td>
          <td style="color:#171717;font-weight:600">${safePlanTitle}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Anlass</td>
          <td style="color:#171717">${safeOccasion}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Datum</td>
          <td style="color:#171717">${safeDate}</td>
        </tr>
        <tr>
          <td style="color:#8b7767;padding:4px 0">Ort</td>
          <td style="color:#171717">${safeCity}</td>
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
        ${safeMessage ? `
        <tr>
          <td style="color:#8b7767;padding:4px 0;vertical-align:top">Nachricht</td>
          <td style="color:#171717">${safeMessage}</td>
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
      subject: `Preisanfrage für ${needLabel} — ${occasionLabel} am ${dateFormatted}`,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  // Diese Route löst Mails aus — entsprechend strenges Limit.
  const limited = enforceRateLimit(req, "events:inquiries", RATE_RULES.mail);
  if (limited) return limited;

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

  if (providers.length > MAX_PROVIDERS_PER_INQUIRY) {
    return NextResponse.json(
      { error: "too_many_providers", max: MAX_PROVIDERS_PER_INQUIRY },
      { status: 400 }
    );
  }

  // needSlug muss ein bekannter Bedarf sein — sonst landen Fantasiewerte in
  // vendor_quotes.need_slug.
  const invalidNeed = providers.find((p) => !p?.id || !NEED_LABEL[p?.needSlug]);
  if (invalidNeed) {
    return NextResponse.json({ error: "invalid_provider_entry" }, { status: 400 });
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

  // Anbieter serverseitig auflösen: E-Mail und Name kommen ausschließlich aus
  // der DB, niemals aus dem Request. Unbekannte IDs werden abgelehnt, damit
  // keine Quote-Zeilen mit erfundenen provider_id entstehen.
  const requestedIds = [...new Set(providers.map((p) => p.id))];
  const { data: dbProviders, error: providerErr } = await admin
    .from("service_providers")
    .select("id, name, contact_email, status")
    .in("id", requestedIds)
    // Der Service-Role-Client umgeht RLS, deshalb hier explizit dieselbe
    // Bedingung wie in der Policy "service_providers_select_active".
    .eq("status", "active");

  if (providerErr) {
    console.error("provider lookup failed:", providerErr.message);
    return NextResponse.json({ error: "provider_lookup_failed" }, { status: 500 });
  }

  const providerById = new Map(
    (dbProviders ?? []).map((p) => [p.id as string, p])
  );

  const unknownIds = requestedIds.filter((id) => !providerById.has(id));
  if (unknownIds.length > 0) {
    return NextResponse.json(
      { error: "unknown_providers", count: unknownIds.length },
      { status: 400 }
    );
  }

  const resolvedProviders: ResolvedProvider[] = providers.map((p) => {
    const db = providerById.get(p.id)!;
    return {
      id: p.id,
      needSlug: p.needSlug,
      email: (db.contact_email as string | null) ?? null,
      name: (db.name as string) ?? "",
    };
  });

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
      customer_message:
        eventData.customerMessage?.slice(0, MAX_CUSTOMER_MESSAGE_LENGTH) || null,
      sent_at:          new Date().toISOString(),
    })
    .select("id")
    .single();

  if (inquiryErr || !inquiry) {
    console.error("inquiry insert failed:", inquiryErr?.message);
    return NextResponse.json({ error: "inquiry_create_failed" }, { status: 500 });
  }

  // Create vendor_quotes + send emails
  const quoteRows = resolvedProviders.map((p) => ({
    inquiry_id:  inquiry.id,
    provider_id: p.id,
    need_slug:   p.needSlug,
    token:       createQuoteToken(),
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
    const provider = resolvedProviders.find((p) => p.id === quote.provider_id);
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
