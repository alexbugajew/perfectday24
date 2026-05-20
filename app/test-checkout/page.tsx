"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TestCheckoutPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout(tier: "partner_basic" | "partner_pro") {
    setLoading(tier);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        router.push(data.url);
      } else {
        alert("Fehler: " + (data.error ?? "Unbekannt"));
      }
    } catch {
      alert("Netzwerkfehler");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Stripe Test</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <button
          onClick={() => void handleCheckout("partner_basic")}
          disabled={!!loading}
          style={{
            padding: "12px 20px",
            background: loading === "partner_basic" ? "#999" : "#171717",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading === "partner_basic" ? "Wird geladen…" : "Partner Basic testen (49 €/Monat)"}
        </button>

        <button
          onClick={() => void handleCheckout("partner_pro")}
          disabled={!!loading}
          style={{
            padding: "12px 20px",
            background: loading === "partner_pro" ? "#999" : "#b76a43",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading === "partner_pro" ? "Wird geladen…" : "Partner Pro testen (149 €/Monat)"}
        </button>
      </div>
    </div>
  );
}
