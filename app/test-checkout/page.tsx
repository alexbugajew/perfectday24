"use client";

import { useState } from "react";

export default function TestCheckoutPage() {
  const [loading, setLoading] = useState<"basic" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(tier: "basic" | "pro") {
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Kein Redirect-URL erhalten");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 400 }}>
      <h1 style={{ marginBottom: 8 }}>Stripe Checkout Test</h1>
      <p style={{ color: "#666", marginBottom: 32, fontSize: 14 }}>
        Nur zum Testen — kein echtes Geld bei Test-Keys.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={() => void startCheckout("basic")}
          disabled={loading !== null}
          style={{
            padding: "12px 20px",
            background: loading === "basic" ? "#999" : "#171717",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: loading !== null ? "not-allowed" : "pointer",
          }}
        >
          {loading === "basic" ? "Wird geladen…" : "Partner Basic testen (49 €/Monat)"}
        </button>

        <button
          onClick={() => void startCheckout("pro")}
          disabled={loading !== null}
          style={{
            padding: "12px 20px",
            background: loading === "pro" ? "#999" : "#b76a43",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: loading !== null ? "not-allowed" : "pointer",
          }}
        >
          {loading === "pro" ? "Wird geladen…" : "Partner Pro testen (149 €/Monat)"}
        </button>
      </div>

      {error && (
        <p style={{ marginTop: 20, color: "#c00", fontSize: 14 }}>
          Fehler: {error}
        </p>
      )}
    </div>
  );
}
