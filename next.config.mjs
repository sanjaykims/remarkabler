/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript type-checking still runs at build time; only ESLint style
  // checks are skipped, so a lint nitpick can't break a deploy.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // better-sqlite3 is a native module; rmapi-js is ESM-only. Both must be
    // externalized so Next doesn't try to bundle them into server chunks.
    serverComponentsExternalPackages: ["better-sqlite3", "rmapi-js"],
  },
};

export default nextConfig;
