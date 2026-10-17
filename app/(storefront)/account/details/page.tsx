import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame } from "@/components/customer/account-frame";
import { SavedDetailsForm } from "@/components/customer/saved-details-form";
import { requireCustomerIdentity } from "@/lib/customer/identity";
import { getCustomerProfile } from "@/lib/customer/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saved details",
  robots: { index: false, follow: false },
};
export default async function CustomerDetails({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const identity = await requireCustomerIdentity("/account/details");
  const params = await searchParams;
  let profile = null;
  let unavailable = false;
  try {
    profile = await getCustomerProfile(identity);
  } catch {
    unavailable = true;
  }
  return (
    <AccountFrame
      eyebrow="Your pastry account"
      title="Details for next time."
      description="Store one preferred contact and delivery address. You can change it at any checkout."
    >
      <Link
        href="/account"
        className="text-brand-strong mb-5 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
      >
        ← Back to orders
      </Link>
      {unavailable ? (
        <div
          role="alert"
          className="border-critical-ink/20 bg-critical text-critical-ink max-w-xl border p-5 text-sm"
        >
          Saved details are temporarily unavailable.{" "}
          <Link href="/account/details" className="font-bold underline">
            Retry
          </Link>
          .
        </div>
      ) : (
        <SavedDetailsForm
          email={identity.email}
          profile={profile}
          message={params.message}
        />
      )}
    </AccountFrame>
  );
}
