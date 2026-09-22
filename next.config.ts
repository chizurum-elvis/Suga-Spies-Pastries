import type { NextConfig } from "next";

import {
  buildPrivateAdminHeaders,
  buildSecurityHeaders,
} from "./lib/security/headers";

const appEnvironment =
  process.env.APP_ENV ??
  (process.env.NODE_ENV === "production" ? "production" : "local");

function getSupabaseImagePattern(): URL | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    url.pathname = "/storage/v1/object/public/product-images/**";
    url.search = "";
    return url;
  } catch {
    return null;
  }
}

const supabaseImagePattern = getSupabaseImagePattern();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],
  poweredByHeader: false,
  images: supabaseImagePattern
    ? { remotePatterns: [supabaseImagePattern] }
    : undefined,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(appEnvironment),
      },
      {
        source: "/admin/:path*",
        headers: buildPrivateAdminHeaders(),
      },
      {
        source: "/checkout/:path*",
        headers: [
          ...buildPrivateAdminHeaders(),
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/orders/:path*",
        headers: [
          ...buildPrivateAdminHeaders(),
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
