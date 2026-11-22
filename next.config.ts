import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A project-specific cache avoids Windows locks left by earlier Next workers.
  distDir: process.env.ATLAS_NEXT_DIST_DIR || ".next-atlas",
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "commons.wikimedia.org", pathname: "/wiki/Special:FilePath/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/commons/**" },
    ],
  },
  experimental: {
    cpus: 1,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
