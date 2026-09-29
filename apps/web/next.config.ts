import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database package exports TypeScript source, which Next must compile.
  transpilePackages: ["@analytic-dashboard/db"],
};

export default nextConfig;
