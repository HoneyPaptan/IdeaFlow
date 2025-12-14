import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Disable TypeScript checks during build for production
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
