// Gemeinsames Layout für alle dynamischen OG-Vorschaubilder (1200×630):
// Einladung, Tagesroute, geteilter Plan. Satori-kompatibles JSX (nur Flex,
// jedes div mit display:flex).

export type ShareCardTheme = {
  from: string;
  mid: string;
  to: string;
  accent: string;
  glow: string;
};

export const PD24_OG_THEME: ShareCardTheme = {
  from: "#fdf6ee",
  mid: "#f5e7d2",
  to: "#efdbc0",
  accent: "#9a5426",
  glow: "rgba(154, 84, 38, 0.18)",
};

export function ShareCard({
  kicker,
  title,
  facts,
  footerNote,
  theme,
  coverUrl,
  emoji,
}: {
  kicker: string;
  title: string;
  facts?: string;
  footerNote: string;
  theme: ShareCardTheme;
  coverUrl?: string | null;
  emoji?: string;
}) {
  const onCover = Boolean(coverUrl);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: onCover
          ? "#111827"
          : `linear-gradient(150deg, ${theme.from} 0%, ${theme.mid} 50%, ${theme.to} 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      {onCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl as string}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover", width: "100%", height: "100%" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            right: -140,
            top: -140,
            width: 460,
            height: 460,
            borderRadius: 9999,
            background: theme.accent,
            opacity: 0.14,
            display: "flex",
          }}
        />
      )}

      {onCover ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(17,24,39,0) 35%, rgba(17,24,39,0.82) 100%)",
            display: "flex",
          }}
        />
      ) : null}

      {!onCover && emoji ? (
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 80,
            width: 148,
            height: 148,
            borderRadius: 9999,
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 76,
            boxShadow: `0 18px 44px ${theme.glow}`,
          }}
        >
          {emoji}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", padding: "0 80px 64px 80px" }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: onCover ? "rgba(255,253,248,0.85)" : theme.accent,
            display: "flex",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            color: onCover ? "#fffdf8" : "#111827",
            display: "flex",
          }}
        >
          {title.length > 60 ? `${title.slice(0, 57)}…` : title}
        </div>
        {facts ? (
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              color: onCover ? "rgba(255,253,248,0.85)" : "#665d55",
              display: "flex",
            }}
          >
            {facts}
          </div>
        ) : null}

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: onCover ? "#fffdf8" : "#111827",
              color: onCover ? "#111827" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            PD
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: onCover ? "#fffdf8" : "#111827",
              display: "flex",
            }}
          >
            PerfectDay24
          </div>
          <div
            style={{
              fontSize: 24,
              color: onCover ? "rgba(255,253,248,0.7)" : "#7a6857",
              display: "flex",
            }}
          >
            {`· ${footerNote}`}
          </div>
        </div>
      </div>
    </div>
  );
}
