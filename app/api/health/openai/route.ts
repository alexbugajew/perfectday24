import { NextResponse } from "next/server";
import { getMonetizationAdminAccessState } from "@/lib/monetization/admin-server";

export async function GET() {
  let isAdmin = false;
  try {
    const access = await getMonetizationAdminAccessState();
    isAdmin = access.allowed;
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) {
    return NextResponse.json({ ok: true });
  }

  const key = process.env.OPENAI_API_KEY;

  // Niemals den Key ausgeben – nur prüfen ob vorhanden. Das frühere
  // keyPrefix-Feld ist entfallen: Es half nur beim Ausspähen der Konfiguration.
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: Boolean(key && key.startsWith("sk-")),
  });
}
