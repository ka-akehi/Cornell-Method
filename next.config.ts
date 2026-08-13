import type { NextConfig } from "next";

// The fixture runner sets this only in its child process. Normal commands keep
// Next.js's default `.next` directory.
const fixtureDistDir = process.env.CORNELL_FIXTURE_DIST_DIR?.trim();
const fixtureTsconfigPath = process.env.CORNELL_FIXTURE_TSCONFIG_PATH?.trim();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  ...(fixtureDistDir ? { distDir: fixtureDistDir } : {}),
  ...(fixtureTsconfigPath
    ? { typescript: { tsconfigPath: fixtureTsconfigPath } }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
