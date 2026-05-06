"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  entity: "slot" | "campaign" | "affiliate" | "product";
  id: string;
  patch: Record<string, unknown>;
  label: string;
  tone?: "neutral" | "active" | "warning";
};

export default function AdminEntityToggle({
  entity,
  id,
  patch,
  label,
  tone = "neutral",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const resp = await fetch("/api/monetization/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, patch }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `request failed (${resp.status})`);
      }

      router.refresh();
    } catch (error) {
      console.error("admin toggle failed:", error);
    } finally {
      setLoading(false);
    }
  }

  const toneClass =
    tone === "active"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-slate-300 bg-white text-slate-900";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {loading ? "Speichert…" : label}
    </button>
  );
}
