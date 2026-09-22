const DEFAULT_ADMIN_PATH = "/admin";

const publicAuthPaths = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/recover",
  "/admin/access-denied",
]);

export function isPublicAdminPath(pathname: string) {
  return (
    publicAuthPaths.has(pathname) || pathname.startsWith("/admin/auth/callback")
  );
}

export function sanitizeAdminReturnPath(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_ADMIN_PATH;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/admin") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("\0")
  ) {
    return DEFAULT_ADMIN_PATH;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate, "https://suga-spies.invalid");
  } catch {
    return DEFAULT_ADMIN_PATH;
  }

  if (parsed.origin !== "https://suga-spies.invalid") {
    return DEFAULT_ADMIN_PATH;
  }

  if (
    isPublicAdminPath(parsed.pathname) ||
    parsed.pathname === "/admin/update-password"
  ) {
    return DEFAULT_ADMIN_PATH;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildAdminLoginPath(returnPath: string, error?: string) {
  const parameters = new URLSearchParams();
  const safeReturnPath = sanitizeAdminReturnPath(returnPath);

  if (safeReturnPath !== DEFAULT_ADMIN_PATH) {
    parameters.set("next", safeReturnPath);
  }

  if (error) {
    parameters.set("error", error);
  }

  const query = parameters.toString();
  return query ? `/admin/login?${query}` : "/admin/login";
}
