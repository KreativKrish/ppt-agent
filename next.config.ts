import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for Vercel deployment
  // Handle external packages that shouldn't be bundled in serverless functions
  serverExternalPackages: ['xlsx'],
};

export default nextConfig;
