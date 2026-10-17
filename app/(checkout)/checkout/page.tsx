import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import {
  CHECKOUT_DRAFT_COOKIE,
  getCheckoutDraft,
} from "@/lib/fulfillment/checkout-draft";
import { getCustomerIdentity } from "@/lib/customer/identity";
import {
  getCustomerProfile,
  profileToDeliveryInput,
} from "@/lib/customer/profile";
import type { DeliveryInput } from "@/lib/delivery/schema";

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

  const account = await getCustomerIdentity();
  let savedDetails: DeliveryInput | null = null;
  if (account) {
    try {
      const profile = await getCustomerProfile(account);
      if (profile)
        savedDetails = profileToDeliveryInput(profile, account.email);
    } catch {
      // Saved details are optional. Guest-style checkout remains available.
    }
  }

  return (
    <CheckoutFlow
      key={`${initialDraft.date}:${initialDraft.expiresAt}`}
      initialDraft={initialDraft}
      savedDetails={savedDetails}
      accountEmail={account?.email}
    />
  );
}
