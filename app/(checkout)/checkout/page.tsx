import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import {
  CHECKOUT_DRAFT_COOKIE,
  getCheckoutDraft,
} from "@/lib/fulfillment/checkout-draft";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Add delivery information, review your order, and pay for your pastries.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  let initialDraft = null;

  try {
    initialDraft = await getCheckoutDraft(
      cookieStore.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
  } catch {
    initialDraft = null;
  }

  if (!initialDraft) redirect("/menu?cart=date");

  return (
    <CheckoutFlow
      key={`${initialDraft.date}:${initialDraft.expiresAt}`}
      initialDraft={initialDraft}
    />
  );
}
