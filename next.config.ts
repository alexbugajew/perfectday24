import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: "https",
        hostname: "nxrkhlokadhwwtuoglxa.supabase.co",
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
      // Imgur
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      // Pixabay
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      // Pexels
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
    // For unknown external hosts that can't be enumerated upfront,
    // the <img> fallback in explore/saved pages handles them gracefully.
    dangerouslyAllowSVG: false,
  },
};

export default nextConfig;
