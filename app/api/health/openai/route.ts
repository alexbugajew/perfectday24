import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;

  // Niemals den Key ausgeben – nur prüfen ob vorhanden
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: Boolean(key && key.startsWith("sk-")),
    keyPrefix: key ? key.slice(0, 3) : null, // zeigt nur "sk-" falls da
  });
}