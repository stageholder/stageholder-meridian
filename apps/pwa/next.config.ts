import type { NextConfig } from "next";

// OIDC front-channel logout depends on the Hub loading our logout URL
// inside a hidden <iframe>. A blanket X-Frame-Options: DENY kills that.
// We scope framing to the Hub's origin via CSP frame-ancestors on the
// single route that needs it and drop XFO there — CSP frame-ancestors
// supersedes XFO in modern browsers but belt-and-braces, we omit XFO.
const HUB_ORIGIN =
  process.env.IDENTITY_ISSUER_URL ??
  process.env.NEXT_PUBLIC_IDENTITY_ISSUER_URL ??
  "http://localhost:4828";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/crypto"],
  turbopack: {},
  async headers() {
    return [
      {
        source: "/auth/frontchannel-logout",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${HUB_ORIGIN}`,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
