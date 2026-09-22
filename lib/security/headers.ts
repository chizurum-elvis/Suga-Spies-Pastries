export type AppEnvironment = "local" | "staging" | "production";

type SecurityHeader = Readonly<{
  key: string;
  value: string;
}>;

const baseSecurityHeaders: readonly SecurityHeader[] = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
];

const strictTransportSecurityHeader: SecurityHeader = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};

const privateAdminHeaders: readonly SecurityHeader[] = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

export function buildSecurityHeaders(
  environment: string | undefined,
): SecurityHeader[] {
  return environment === "production"
    ? [...baseSecurityHeaders, strictTransportSecurityHeader]
    : [...baseSecurityHeaders];
}

export function buildPrivateAdminHeaders(): SecurityHeader[] {
  return [...privateAdminHeaders];
}
