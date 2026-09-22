import type { Metadata } from "next";
import { cookies } from "next/headers";

import { FulfillmentPlanner } from "@/components/checkout/fulfillment-planner";
import {
  CHECKOUT_DRAFT_COOKIE,
  getCheckoutDraft,
} from "@/lib/fulfillment/checkout-draft";
import { getMonthForDate, getTorontoLocalDate } from "@/lib/fulfillment/rules";

export const metadata: Metadata = {
  title: "Choose delivery date",
  description: "Choose an available date for your pastry delivery.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FulfillmentPage() {
  const cookieStore = await cookies();
  let initialDraft = null;

  try {
    initialDraft = await getCheckoutDraft(
      cookieStore.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
  } catch {
    initialDraft = null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="border-border mb-7 border-b pb-6 sm:mb-9 sm:pb-8">
        <p className="text-brand-strong text-xs font-extrabold tracking-[0.14em] uppercase">
          Delivery
        </p>
        <h1 className="font-display text-ink mt-3 text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.92]">
          Choose your delivery date
        </h1>
        <p className="text-ink-soft mt-3 max-w-xl text-sm leading-6 sm:text-base">
          Select an available date, then continue to your contact information
          and payment.
        </p>
      </header>
      <FulfillmentPlanner
        initialDraft={initialDraft}
        initialMonth={getMonthForDate(getTorontoLocalDate())}
      />
    </div>
  );
}
