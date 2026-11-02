import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/disputes/:path*",
        destination: "/legacy-phalanx/api/disputes/:path*",
      },
      {
        source: "/api/demo/:path*",
        destination: "/legacy-phalanx/api/demo/:path*",
      },
      {
        source: "/api/webhooks/paypal",
        destination: "/legacy-phalanx/api/webhooks/paypal",
      },
    ];
  },
};

export default nextConfig;
