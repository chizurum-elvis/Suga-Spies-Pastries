type PaymentMode = "disabled" | "test" | "live";

/** Public wording only. Checkout remains the authority on current payment readiness. */
export function storefrontCheckoutNotice(
  mode: PaymentMode,
  configurationBlockers: readonly string[],
): string | null {
  if (mode === "disabled") {
    return "Online ordering is not open yet. You can still browse the pastry menu.";
  }
  if (mode === "test") {
    return "Checkout is in test mode. No real pastry order will be placed.";
  }
  if (configurationBlockers.length > 0) {
    return "Online checkout is temporarily unavailable. You can still browse the pastry menu.";
  }
  return null;
}
