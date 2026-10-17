import type { Metadata } from "next";
import { AccountAuthForm } from "@/components/customer/account-auth-form";
import { AccountFrame } from "@/components/customer/account-frame";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Recover password",
  robots: { index: false },
};
export default function CustomerForgotPassword() {
  return (
    <AccountFrame
      eyebrow="Account help"
      title="Find your way back."
      description="Enter your account email. If it belongs to an account, we’ll send a private recovery link."
    >
      <AccountAuthForm
        mode="forgot"
        configured={getSupabaseConfigurationState().status === "configured"}
      />
    </AccountFrame>
  );
}
