"use client";

import { useMemo, useState } from "react";

// Interaktiver ROI-Rechner. Reine Client-Logik, kein API-Call.
// Zwei Slider: Buchungen/Monat und Ø Auftragswert. Zeigt Break-Even
// gegenueber Partner-Basic (49€) und Pro (149€).

const BASIC_MONTHLY_CENTS = 4900;
const PRO_MONTHLY_CENTS = 14900;
// Konservative Annahme: PerfectDay24 leitet den Kunden weiter, du machst
// Marge auf jeder Buchung. Wir rechnen mit 15% Marge auf den Auftragswert.
const DEFAULT_MARGIN_PCT = 15;

function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`;
}

export default function PartnerRoiCalculator() {
  const [bookings, setBookings] = useState(3);
  const [avgOrderEuros, setAvgOrderEuros] = useState(500);
  const [marginPct, setMarginPct] = useState(DEFAULT_MARGIN_PCT);

  const result = useMemo(() => {
    const monthlyRevenueCents = bookings * avgOrderEuros * 100;
    const marginCents = Math.round((monthlyRevenueCents * marginPct) / 100);
    const netBasic = marginCents - BASIC_MONTHLY_CENTS;
    const netPro = marginCents - PRO_MONTHLY_CENTS;
    const breakEvenBasic = Math.ceil(BASIC_MONTHLY_CENTS / ((avgOrderEuros * 100 * marginPct) / 100));
    const breakEvenPro = Math.ceil(PRO_MONTHLY_CENTS / ((avgOrderEuros * 100 * marginPct) / 100));
    return {
      monthlyRevenueCents,
      marginCents,
      netBasic,
      netPro,
      breakEvenBasic: Number.isFinite(breakEvenBasic) ? breakEvenBasic : 0,
      breakEvenPro: Number.isFinite(breakEvenPro) ? breakEvenPro : 0,
    };
  }, [bookings, avgOrderEuros, marginPct]);

  return (
    <div className="rounded-[28px] border border-[rgba(196,137,79,0.28)] bg-[linear-gradient(160deg,rgba(255,249,241,0.94),rgba(255,253,248,0.72))] p-6 shadow-[var(--shadow-soft)] sm:p-7">
      <div className="pd24-kicker-warm">ROI-Rechner</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
        Ab wie vielen Buchungen lohnt sich das?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted-warm)]">
        Konservativ gerechnet: Nur der Deckungsbeitrag pro vermittelter Buchung, kein
        Uplift durch Sichtbarkeit oder Wiederkehrer.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
        {/* Slider */}
        <div className="space-y-4">
          <SliderRow
            label="Buchungen pro Monat"
            value={bookings}
            unit=""
            min={0}
            max={20}
            step={1}
            onChange={setBookings}
          />
          <SliderRow
            label="Ø Auftragswert (Brutto)"
            value={avgOrderEuros}
            unit=" €"
            min={100}
            max={5000}
            step={50}
            onChange={setAvgOrderEuros}
          />
          <SliderRow
            label="Deine Deckungsbeitragsquote"
            value={marginPct}
            unit=" %"
            min={5}
            max={50}
            step={1}
            onChange={setMarginPct}
          />
        </div>

        {/* Ergebnis */}
        <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft-warm)]">
            Deine Rechnung
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-semibold text-[var(--text-strong)]">
              {euros(result.marginCents)}
            </div>
            <div className="text-xs text-[var(--text-muted-warm)]">Rohmarge / Monat</div>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted-warm)]">
            aus {euros(result.monthlyRevenueCents)} Umsatz · {marginPct}%
          </div>

          <div className="mt-5 space-y-3">
            <PlanResult
              tier="Basic"
              price={BASIC_MONTHLY_CENTS}
              net={result.netBasic}
              breakEven={result.breakEvenBasic}
              isRecommended={false}
            />
            <PlanResult
              tier="Pro"
              price={PRO_MONTHLY_CENTS}
              net={result.netPro}
              breakEven={result.breakEvenPro}
              isRecommended={result.netPro > result.netBasic && result.netPro > 0}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-[var(--line-subtle)] bg-white/72 px-4 py-3 text-xs leading-5 text-[var(--text-muted-warm)]">
        Konservative Kalkulation. Reale Erfahrungswerte: Partner mit vollstaendigem Profil
        + gepflegten Bildern haben typischerweise 2-3× mehr Anfragen als die
        Ausgangsannahme dieses Rechners.
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-[var(--text-strong)]">{label}</div>
        <div className="text-lg font-semibold text-[var(--brand-warm)]">
          {value.toLocaleString("de-DE")}
          {unit}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--brand-warm)]"
        aria-label={label}
      />
      <div className="flex justify-between text-[10px] text-[var(--text-soft-warm)]">
        <span>{min.toLocaleString("de-DE")}{unit}</span>
        <span>{max.toLocaleString("de-DE")}{unit}</span>
      </div>
    </div>
  );
}

function PlanResult({
  tier,
  price,
  net,
  breakEven,
  isRecommended,
}: {
  tier: string;
  price: number;
  net: number;
  breakEven: number;
  isRecommended: boolean;
}) {
  const profitable = net > 0;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
        profitable
          ? "border-[rgba(24,140,80,0.28)] bg-[rgba(230,246,236,0.5)]"
          : "border-[var(--line-subtle)] bg-white"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-strong)]">Partner {tier}</span>
          <span className="text-[10px] text-[var(--text-muted-warm)]">{euros(price)}/Monat</span>
          {isRecommended ? (
            <span className="rounded-full bg-[var(--brand-warm)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
              Empfohlen
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-[var(--text-muted-warm)]">
          {profitable
            ? `Netto ${euros(net)} übrig`
            : breakEven > 0
              ? `Break-Even ab ${breakEven} Buchungen`
              : "Nicht abbildbar mit diesen Werten"}
        </div>
      </div>
      <div
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
          profitable
            ? "bg-[rgba(24,140,80,0.14)] text-[#166534]"
            : "bg-[rgba(23,23,23,0.05)] text-[var(--text-muted-warm)]"
        }`}
      >
        {profitable ? "profitabel" : "nicht profitabel"}
      </div>
    </div>
  );
}
