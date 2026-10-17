import type { Metadata } from "next";
import { AccountAuthForm } from "@/components/customer/account-auth-form";
import { AccountFrame } from "@/components/customer/account-frame";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};
export default function CustomerRegister() {
  const configured = getSupabaseConfigurationState().status === "configured";
  return (
    <AccountFrame
      eyebrow="Optional account"
      title="Make the next order easier."
      description="Save your details and bring past orders into one place after verifying your email. You can always order as a guest."
    >
      <AccountAuthForm
        mode="register"
        configured={configured}
        pageMessage={
          !configured
            ? {
                status: "error",
                message: "Account creation is temporarily unavailable.",
              }
            : undefined
        }
      />
    </AccountFrame>
  );
}
