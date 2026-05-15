/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript type-checking still runs at build time; only ESLint style
  // checks are skipped, so a lint nitpick can't break a deploy.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
