import type { Metadata } from "next";
import { AccountFrame } from "@/components/customer/account-frame";
import { VerificationForm } from "@/components/customer/verification-form";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
};
export default function CustomerVerify() {
  return (
    <AccountFrame
      eyebrow="Email verification"
      title="Need a fresh link?"
      description="Verification links expire. Enter the email you registered with and we’ll try sending another."
    >
      <VerificationForm
        configured={getSupabaseConfigurationState().status === "configured"}
      />
    </AccountFrame>
  );
}
