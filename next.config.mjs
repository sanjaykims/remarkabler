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
    // Loads instrumentation.ts once at server boot (Next 14.2 requires this
    // flag explicitly; it's default-on from Next 15). That file installs the
    // process-level unhandledRejection/uncaughtException safety net — see
    // its own comment for why that matters on a fire-and-forget-heavy app.
    instrumentationHook: true,
  },
  // Baseline hardening headers on every response. No Content-Security-Policy
  // here on purpose: this app has no next/image usage and no middleware, so
  // exposure to most currently-open Next.js CVEs (image optimizer, i18n
  // middleware bypass) is low, and a hand-rolled CSP risks silently breaking
  // the UI for a non-technical, phone-only user with no easy way to diagnose
  // it — a real CSP deserves its own tested pass, not a drive-by addition.
  // OAuth discovery lives at well-known paths (RFC 9728 / RFC 8414). Serve
  // them from normal API routes via rewrites — folders starting with a dot in
  // app/ are treated as hidden by Next, so a route file there wouldn't map.
  // The `/api/mcp`-suffixed variants cover clients that append the resource
  // path when locating metadata.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/mcp/oauth/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/api/mcp",
        destination: "/api/mcp/oauth/protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/mcp/oauth/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/api/mcp",
        destination: "/api/mcp/oauth/authorization-server",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Only geolocation (Memory page's "capture current location")
            // and microphone (chat's voice input) are actually used.
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
