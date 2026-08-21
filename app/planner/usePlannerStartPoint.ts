import { useEffect, useMemo, useState } from "react";
import { canonicalCitySlug } from "@/lib/cities/canonical";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { haversineKm, type StartPointType } from "@/lib/planner";
import { cityStartFallbackLabel } from "./helpers";
import type { CityRow, StartPoint, StartPointSuggestion } from "./types";

const DEFAULT_START_POINT: StartPoint = {
  mode: "current_location",
  type: "address",
  label: "",
  lat: null,
  lng: null,
};

/**
 * Ab dieser Entfernung zum Stadtzentrum gehoert ein gespeicherter Startpunkt
 * offensichtlich nicht mehr zur gewaehlten Stadt.
 *
 * Grosszuegig gewaehlt: Berlin misst rund 45 km in der Ausdehnung, und ein
 * Flughafen darf auch ausserhalb liegen. Es geht nur darum, den Fall
 * abzufangen, dass jemand zuletzt eine voellig andere Stadt geplant hat.
 */
const START_POINT_CITY_RADIUS_KM = 60;

type UsePlannerStartPointParams = {
  mounted: boolean;
  cities: CityRow[];
  visibleCities: CityRow[];
  selectedCountryCode: string;
  selectedCitySlug: string | null;
  /**
   * True, wenn der Startpunkt aus der URL kommt. Dann ist er gesetzt und
   * gewollt — die Stadt-Plausibilitaet darf ihn nicht anfassen.
   */
  startPointFromUrl?: boolean;
};

export function usePlannerStartPoint({
  mounted,
  cities,
  visibleCities,
  selectedCountryCode,
  selectedCitySlug,
  startPointFromUrl = false,
}: UsePlannerStartPointParams) {
  const [autoCitySlug, setAutoCitySlug] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<StartPoint>(DEFAULT_START_POINT);
  const [startPointSuggestions, setStartPointSuggestions] = useState<StartPointSuggestion[]>([]);
  const [startPointSearchLoading, setStartPointSearchLoading] = useState(false);
  const [startPointSearchError, setStartPointSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    // Ein Startpunkt aus der URL schlaegt den gespeicherten. Ohne diese Sperre
    // legt der wiederhergestellte Wert sich darueber — und weil ein frueher
    // verworfener Startpunkt als leerer Wert gespeichert wird, landete man bei
    // "Kein Startpunkt", obwohl der Link einen Ort mitbrachte.
    if (startPointFromUrl) return;
    try {
      const raw = localStorage.getItem("pd24_start_point");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setStartPoint((prev) => ({
          ...prev,
          mode: parsed.mode === "custom" ? "custom" : "current_location",
          type:
            parsed.type === "hotel" ||
            parsed.type === "station" ||
            parsed.type === "airport" ||
            parsed.type === "other"
              ? parsed.type
              : "address",
          label: typeof parsed.label === "string" ? parsed.label : "",
          lat: typeof parsed.lat === "number" ? parsed.lat : null,
          lng: typeof parsed.lng === "number" ? parsed.lng : null,
        }));
      }
    } catch {}
  }, [mounted, startPointFromUrl]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_start_point", JSON.stringify(startPoint));
    } catch {}
  }, [mounted, startPoint]);

  /**
   * Verwirft einen Startpunkt, der nicht zur gewaehlten Stadt gehoert.
   *
   * Der Startpunkt wird ohne Stadtbezug in localStorage gehalten. Wer zuletzt
   * Koeln geplant hatte und dann ueber einen Link in Hamburg landet, behielt
   * "Koeln Altstadt / Dom" als Start — die Karte zeigte Koeln, und der Plan
   * meldete fuer jeden Stop "keine Location gepasst", weil 400 km entfernt
   * gesucht wurde.
   *
   * Das betrifft jeden Link mit `citySlug`: Stadtseiten, Anlass-Seiten und die
   * Event-Strecke. Deshalb wird hier zurueckgesetzt statt an jeder Aufrufstelle.
   */
  useEffect(() => {
    if (!mounted) return;
    if (!selectedCitySlug) return;
    // Ein Startpunkt aus der URL ist ausdruecklich gewollt. Ohne diese Sperre
    // schlaegt die Pruefung im ersten Durchlauf zu, weil `selectedCitySlug`
    // dann noch die alte Stadt haelt: Der Hamburger Veranstaltungsort wird
    // gegen Berlin gemessen, landet bei 255 km — und ist wieder weg.
    if (startPointFromUrl) return;
    if (typeof startPoint.lat !== "number" || typeof startPoint.lng !== "number") return;

    // Fuer 330 der 4.455 Staedte fehlt der Mittelpunkt in der Datenbank —
    // darunter Hamburg. Die Rollout-Konfiguration hat ihn, also dient sie als
    // Rueckfallebene, sonst greift die Pruefung ausgerechnet dort nicht.
    const city = cities.find((entry) => entry.slug === selectedCitySlug);
    const rollout = PLANNER_33_ROLLOUT.find((entry) => entry.slug === selectedCitySlug);
    const centerLat =
      typeof city?.center_lat === "number" ? city.center_lat : rollout?.lat ?? null;
    const centerLng =
      typeof city?.center_lng === "number" ? city.center_lng : rollout?.lng ?? null;
    if (typeof centerLat !== "number" || typeof centerLng !== "number") return;

    const distanceKm = haversineKm(startPoint.lat, startPoint.lng, centerLat, centerLng);
    if (distanceKm <= START_POINT_CITY_RADIUS_KM) return;

    setStartPoint(DEFAULT_START_POINT);
  }, [mounted, selectedCitySlug, cities, startPoint, setStartPoint, startPointFromUrl]);

  useEffect(() => {
    if (!mounted) return;
    if (!navigator.geolocation) {
      setGeoError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      (err) => setGeoError(err.message || "Standort konnte nicht ermittelt werden."),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [mounted]);

  useEffect(() => {
    if (!cities.length) return;
    if (userLat == null || userLng == null) return;

    let bestSlug: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    const sourceCities =
      selectedCountryCode === "all"
        ? cities
        : cities.filter(
            (city) => (city.country_code?.toUpperCase() ?? "") === selectedCountryCode
          );

    for (const city of sourceCities) {
      if (typeof city.center_lat !== "number" || typeof city.center_lng !== "number") continue;
      const distance = haversineKm(userLat, userLng, city.center_lat, city.center_lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlug = city.slug;
      }
    }

    setAutoCitySlug(bestSlug);
  }, [cities, userLat, userLng, selectedCountryCode]);

  const effectiveCitySlug = useMemo(() => {
    return (
      canonicalCitySlug(selectedCitySlug) ??
      canonicalCitySlug(autoCitySlug) ??
      canonicalCitySlug(visibleCities[0]?.slug ?? null)
    );
  }, [selectedCitySlug, autoCitySlug, visibleCities]);

  const selectedCity = useMemo(
    () =>
      visibleCities.find((city) => city.slug === effectiveCitySlug) ??
      cities.find((city) => city.slug === effectiveCitySlug) ??
      null,
    [visibleCities, cities, effectiveCitySlug]
  );

  const shouldUseCurrentLocationAsOrigin = useMemo(() => {
    if (startPoint.mode !== "current_location") return false;
    if (userLat == null || userLng == null) return false;
    if (!selectedCitySlug) return true;
    if (!autoCitySlug) return false;
    return selectedCitySlug === autoCitySlug;
  }, [startPoint.mode, userLat, userLng, selectedCitySlug, autoCitySlug]);

  const suggestedCustomStartPoint = useMemo<StartPointSuggestion | null>(() => {
    if (startPoint.mode !== "custom") return null;
    if (startPoint.lat != null && startPoint.lng != null) return null;

    const query = startPoint.label.trim().toLowerCase();
    if (query.length < 2 || startPointSuggestions.length === 0) return null;

    return (
      startPointSuggestions.find((suggestion) => suggestion.label.trim().toLowerCase() === query) ??
      startPointSuggestions.find((suggestion) =>
        suggestion.label.trim().toLowerCase().startsWith(query)
      ) ??
      startPointSuggestions[0] ??
      null
    );
  }, [startPoint.mode, startPoint.label, startPoint.lat, startPoint.lng, startPointSuggestions]);

  const manualStartFallsBackToCityCenter = useMemo(() => {
    return (
      startPoint.mode === "custom" &&
      startPoint.lat == null &&
      startPoint.lng == null &&
      suggestedCustomStartPoint == null &&
      selectedCity?.center_lat != null &&
      selectedCity?.center_lng != null
    );
  }, [startPoint.mode, startPoint.lat, startPoint.lng, suggestedCustomStartPoint, selectedCity]);

  const selectedCityFallbackLabel = useMemo(() => {
    return cityStartFallbackLabel(selectedCity);
  }, [selectedCity]);

  const effectiveStartPoint = useMemo<StartPoint>(() => {
    if (startPoint.mode === "custom" && startPoint.lat != null && startPoint.lng != null) {
      return {
        mode: "custom",
        type: startPoint.type,
        label: startPoint.label.trim() || "Manueller Startpunkt",
        lat: startPoint.lat,
        lng: startPoint.lng,
      };
    }

    if (startPoint.mode === "custom") {
      if (suggestedCustomStartPoint) {
        return {
          mode: "custom",
          type: suggestedCustomStartPoint.type,
          label: suggestedCustomStartPoint.label,
          lat: suggestedCustomStartPoint.lat,
          lng: suggestedCustomStartPoint.lng,
        };
      }

      if (selectedCity?.center_lat != null && selectedCity?.center_lng != null) {
        return {
          mode: "custom",
          type: startPoint.type,
          label: selectedCityFallbackLabel,
          lat: selectedCity.center_lat,
          lng: selectedCity.center_lng,
        };
      }

      return {
        mode: "custom",
        type: startPoint.type,
        label: startPoint.label.trim() || "Manueller Startpunkt",
        lat: startPoint.lat,
        lng: startPoint.lng,
      };
    }

    if (shouldUseCurrentLocationAsOrigin) {
      return {
        mode: "current_location",
        type: "address",
        label: "Aktueller Standort",
        lat: userLat,
        lng: userLng,
      };
    }

    if (selectedCity?.center_lat != null && selectedCity?.center_lng != null) {
      return {
        mode: "custom",
        type: "address",
        label: selectedCityFallbackLabel,
        lat: selectedCity.center_lat,
        lng: selectedCity.center_lng,
      };
    }

    return {
      mode: startPoint.mode,
      type: startPoint.type,
      label: startPoint.label || "Kein Startpunkt",
      lat: null,
      lng: null,
    };
  }, [
    startPoint,
    shouldUseCurrentLocationAsOrigin,
    userLat,
    userLng,
    selectedCity,
    selectedCityFallbackLabel,
    suggestedCustomStartPoint,
  ]);

  const hasValidPlannerOrigin = useMemo(() => {
    return effectiveStartPoint.lat != null && effectiveStartPoint.lng != null;
  }, [effectiveStartPoint.lat, effectiveStartPoint.lng]);

  useEffect(() => {
    if (startPoint.mode !== "custom") {
      setStartPointSuggestions([]);
      setStartPointSearchLoading(false);
      setStartPointSearchError(null);
      return;
    }

    // Startpunkt ist bereits konkret gewählt — keine neue Suche anstoßen,
    // sonst öffnet sich das Vorschlags-Dropdown direkt nach der Auswahl erneut.
    if (startPoint.lat != null && startPoint.lng != null) {
      setStartPointSuggestions([]);
      setStartPointSearchLoading(false);
      setStartPointSearchError(null);
      return;
    }

    const query = startPoint.label.trim();
    if (query.length < 2 && !effectiveCitySlug) {
      setStartPointSuggestions([]);
      setStartPointSearchLoading(false);
      setStartPointSearchError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setStartPointSearchLoading(true);
        setStartPointSearchError(null);

        const url = new URL("/api/geocode/search", window.location.origin);
        if (query.length > 0) {
          url.searchParams.set("q", query);
        }
        url.searchParams.set("type", startPoint.type);
        url.searchParams.set("limit", "8");
        if (effectiveCitySlug) {
          url.searchParams.set("citySlug", effectiveCitySlug);
        }

        const res = await fetch(url.toString());
        const json = (await res.json()) as {
          suggestions?: StartPointSuggestion[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(json.error || `Geocode Fehler: ${res.status}`);
        }

        if (!cancelled) {
          setStartPointSuggestions(json.suggestions ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Start point search failed:", error);
          setStartPointSuggestions([]);
          setStartPointSearchError("Startpunkt-Suche aktuell nicht verfügbar.");
        }
      } finally {
        if (!cancelled) {
          setStartPointSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [startPoint.mode, startPoint.label, startPoint.type, startPoint.lat, startPoint.lng, effectiveCitySlug]);

  function resetStartPointForSelectedCity() {
    setStartPoint({
      mode: "custom",
      type: "address",
      label: "",
      lat: null,
      lng: null,
    });
    setStartPointSuggestions([]);
    setStartPointSearchLoading(false);
    setStartPointSearchError(null);
  }

  function applyStartPointSuggestion(suggestion: StartPointSuggestion) {
    setStartPoint({
      mode: "custom",
      type: suggestion.type,
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
    setStartPointSuggestions([]);
    setStartPointSearchError(null);
  }

  function updateStartPointType(type: StartPointType) {
    setStartPoint((prev) => ({
      ...prev,
      type,
      lat: null,
      lng: null,
    }));
  }

  function useCurrentLocationAsStartPoint() {
    setStartPoint((prev) => ({
      ...prev,
      mode: "current_location",
      lat: userLat,
      lng: userLng,
      label: "Aktueller Standort",
    }));
    setStartPointSuggestions([]);
    setStartPointSearchError(null);
  }

  function clearStartPoint() {
    setStartPoint((prev) => ({
      ...prev,
      mode: "custom",
      type: "address",
      label: "",
      lat: null,
      lng: null,
    }));
    setStartPointSuggestions([]);
    setStartPointSearchError(null);
  }

  return {
    autoCitySlug,
    geoError,
    userLat,
    userLng,
    startPoint,
    setStartPoint,
    startPointSuggestions,
    startPointSearchLoading,
    startPointSearchError,
    effectiveCitySlug,
    selectedCity,
    suggestedCustomStartPoint,
    manualStartFallsBackToCityCenter,
    selectedCityFallbackLabel,
    shouldUseCurrentLocationAsOrigin,
    effectiveStartPoint,
    hasValidPlannerOrigin,
    resetStartPointForSelectedCity,
    applyStartPointSuggestion,
    updateStartPointType,
    useCurrentLocationAsStartPoint,
    clearStartPoint,
  };
}
