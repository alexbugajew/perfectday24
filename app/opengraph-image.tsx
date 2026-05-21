import { ImageResponse } from "next/og";

export const alt = "PerfectDay24 – Deinen Tag planen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const trustSignals = ["Echte Events", "Realistische Wege", "Per Link teilen"];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #f7f4ee 0%, #ede4d8 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Logo row */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
        <div
          style={{
            width: "52px",
            height: "52px",
            background: "#171717",
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fffdf8",
            fontSize: "22px",
            fontWeight: "700",
          }}
        >
          P
        </div>
        <div style={{ fontSize: "26px", fontWeight: "700", color: "#171717", letterSpacing: "-0.02em" }}>
          PerfectDay24
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: "62px",
          fontWeight: "700",
          color: "#171717",
          letterSpacing: "-0.03em",
          lineHeight: "1.05",
          maxWidth: "900px",
        }}
      >
        Dein perfekter Tag — konkret geplant.
      </div>

      {/* Subline */}
      <div
        style={{
          marginTop: "24px",
          fontSize: "26px",
          color: "#665d55",
          lineHeight: "1.5",
          maxWidth: "720px",
        }}
      >
        Stadt, Anlass, echte Events. PerfectDay24 erstellt daraus einen vollständigen Tagesplan.
      </div>

      {/* Pills */}
      <div style={{ marginTop: "48px", display: "flex", gap: "14px" }}>
        {trustSignals.map((label) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(23,23,23,0.12)",
              borderRadius: "999px",
              padding: "10px 22px",
              fontSize: "18px",
              color: "#665d55",
              fontWeight: "500",
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    { ...size }
  );
}
