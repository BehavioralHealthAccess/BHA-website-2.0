import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Force module resolution to webapp/ so root-level npm artifacts do not interfere.
    root: process.cwd(),
  },
};

export default nextConfig;
