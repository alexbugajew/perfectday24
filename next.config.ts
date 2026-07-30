import type { NextConfig } from "next";

const SUPABASE_HOST = "nxrkhlokadhwwtuoglxa.supabase.co";

/**
 * Content-Security-Policy.
 *
 * Wird zunächst als `Content-Security-Policy-Report-Only` ausgeliefert, damit
 * echte Verstöße sichtbar werden, ohne die Seite zu brechen. Wenn die Konsole
 * über einige Tage ruhig bleibt, kann `CSP_ENFORCE=true` gesetzt werden — dann
 * greift die Policy scharf.
 *
 * `unsafe-inline` bei style-src ist nötig, weil Leaflet und React inline-Styles
 * setzen. `unsafe-eval` bleibt auf die Entwicklungsumgebung beschränkt (HMR).
 */
function buildCsp(isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'", // Next.js Bootstrap-/Hydration-Skripte
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://js.stripe.com",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      `https://${SUPABASE_HOST}`,
      `wss://${SUPABASE_HOST}`,
      "https://nominatim.openstreetmap.org",
      "https://router.project-osrm.org",
      "https://api.stripe.com",
    ].join(" "),
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Verrät sonst die Framework-Version in jeder Antwort.
  poweredByHeader: false,
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = buildCsp(isDev);
    const cspHeaderName =
      process.env.CSP_ENFORCE === "true"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only";

    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking — deckt zusammen mit frame-ancestors auch alte Browser ab.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Verhindert, dass Share-Token-URLs (/p/<token>) über den Referer an
          // externe Affiliate-Ziele durchsickern.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Geolocation wird für den Planner genutzt, alles andere abschalten.
            value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: cspHeaderName, value: csp },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
  images: {
    // Begrenzt, wie lange optimierte Varianten im Cache wachsen können.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      // Supabase Storage
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
        pathname: "/storage/v1/object/public/**",
      },
      // Unsplash (route cover images, attribution)
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      // Wikimedia Commons (route cover images from OSM/Wikipedia sources)
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/**",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      // Google user profile photos (OAuth avatars)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // Microsoft / Azure profile photos
      {
        protocol: "https",
        hostname: "graph.microsoft.com",
      },
      // Cloudinary (third-party route images)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Imgur — nur der direkte Bildpfad, nicht die ganze Domain.
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      // Pixabay
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
        pathname: "/photo/**",
      },
      // Pexels
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/photos/**",
      },
    ],
    // For unknown external hosts that can't be enumerated upfront,
    // the <img> fallback in explore/saved pages handles them gracefully.
    dangerouslyAllowSVG: false,
  },
};

export default nextConfig;
