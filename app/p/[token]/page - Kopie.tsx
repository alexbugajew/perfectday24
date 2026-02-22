"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PublicPlan = {
  id: string;
  title: string | null;
  created_at: string;
  radius_km: number;
  effective_radius_km: number | null;
  sort_mode: string;
  active_level: string | null;
  filters: any;
  slots: any; // jsonb
};

export default function PublicPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // ✅ Next 15/16: params ist ein Promise -> unwrap mit React.use()
  const { token: rawToken } = React.use(params);

  // Token stabil + bereinigt
  const token = useMemo(() => (rawToken ?? "").trim(), [rawToken]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("plans")
          .select(
            "id,title,created_at,radius_km,effective_radius_km,sort_mode,active_level,filters,slots"
          )
          .eq("share_token", token)
          .single();

        if (!active) return;

        if (error || !data) {
          setPlan(null);
          setError("Plan nicht gefunden oder Link ungültig.");
          setLoading(false);
          return;
        }

        setPlan(data as PublicPlan);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setPlan(null);
        setError("Unerwarteter Fehler beim Laden des Plans.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="p-10 max-w-3xl mx-auto">
        <div className="p-4 border rounded-lg">Lade Plan…</div>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="p-10 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">PerfectDay24</h1>
        <div className="p-4 border rounded-lg text-sm text-gray-700">
          {error ?? "Unbekannter Fehler"}
        </div>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        {plan.title || "Geteilter Plan"}
      </h1>

      <div className="text-sm text-gray-600 mb-6">
        {new Date(plan.created_at).toLocaleString()} • Radius: {plan.radius_km}{" "}
        km
        {plan.effective_radius_km
          ? ` (effektiv ${plan.effective_radius_km} km)`
          : ""}{" "}
        • Sort: {plan.sort_mode} • Level: {plan.active_level || "n/a"}
      </div>

      <div className="p-4 border rounded-lg mb-6">
        <div className="text-sm text-gray-700">
          <b>Filter:</b> Budget: {plan.filters?.budget} • Occasion:{" "}
          {plan.filters?.occasion} • Daytime: {plan.filters?.daytime}
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-3">Tagesplan</h2>

      <div className="space-y-3">
        {(plan.slots || []).map((s: any) => (
          <div key={s.slot} className="p-4 border rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{s.label}</div>
                <div className="text-xs text-gray-500 mb-2">{s.hint}</div>

                {s.location ? (
                  <>
                    <div className="text-sm font-medium">{s.location.name}</div>
                    <div className="text-xs text-gray-500">{s.location.type}</div>
                    {typeof s.location.distanceKm === "number" ? (
                      <div className="text-xs text-gray-500">
                        {s.location.distanceKm.toFixed(1)} km
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-gray-600">—</div>
                )}
              </div>

              {s.location?.reservation_url ? (
                <a
                  href={s.location.reservation_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded bg-black text-white text-sm"
                >
                  Reservieren
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-xs text-gray-500">
        Geteilt via PerfectDay24 • Link enthält ein Token (jeder mit Link kann
        diesen Plan sehen).
      </div>
    </main>
  );
}