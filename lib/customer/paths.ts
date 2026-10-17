const DEFAULT_PATH = "/account";

export function safeCustomerReturnPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PATH;
  const candidate = value.trim();
  if (
    candidate !== value ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("\0")
  )
    return DEFAULT_PATH;
  try {
    const url = new URL(candidate, "https://suga-spies.invalid");
    if (url.origin !== "https://suga-spies.invalid") return DEFAULT_PATH;
    if (
      url.pathname === "/account" ||
      url.pathname === "/account/details" ||
      url.pathname === "/checkout" ||
      /^\/orders\/[0-9a-f-]{36}$/i.test(url.pathname)
    )
      return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Invalid redirects fall back to the account home.
  }
  return DEFAULT_PATH;
}

export function customerLoginPath(returnTo = DEFAULT_PATH) {
  const safe = safeCustomerReturnPath(returnTo);
  return safe === DEFAULT_PATH
    ? "/account/login"
    : `/account/login?next=${encodeURIComponent(safe)}`;
}
