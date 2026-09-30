import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database package exports TypeScript source, which Next must compile.
  transpilePackages: ["@analytic-dashboard/db"],
  allowedDevOrigins: ["192.168.0.103"],
  images: {
    // Store icon hosts returned by the collectors (Apple CDN shards and Google Play).
    remotePatterns: [
      { protocol: "https", hostname: "*.mzstatic.com" },
      { protocol: "https", hostname: "play-lh.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
