/** Resend's shared sender is for testing, never a business production sender. */
export function isResendTestSender(address: string | undefined) {
  const domain = address?.trim().toLowerCase().split("@")[1];
  return domain === "resend.dev" || Boolean(domain?.endsWith(".resend.dev"));
}

export function orderEmailSender(address: string) {
  return `Suga & Spies <${address}>`;
}
