import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Turbopack disabled due to Windows symlink permissions */
  // Pin the tracing root to the current package to avoid Next.js picking the parent lockfile
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
