import type { Metadata } from "next";
import { AccountAuthForm } from "@/components/customer/account-auth-form";
import { AccountFrame } from "@/components/customer/account-frame";
import { safeCustomerReturnPath } from "@/lib/customer/paths";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import type { AuthActionState } from "@/lib/auth/action-state";
import { getCustomerIdentity } from "@/lib/customer/identity";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};
export default async function CustomerLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const identity = await getCustomerIdentity();
  if (identity) redirect(safeCustomerReturnPath(params.next));
  const configured = getSupabaseConfigurationState().status === "configured";
  const message: AuthActionState | undefined = !configured
    ? {
        status: "error",
        message: "Customer sign-in is temporarily unavailable.",
      }
    : params.message === "password_updated"
      ? {
          status: "success",
          message: "Password updated. Sign in with your new password.",
        }
      : params.message === "signed_out"
        ? { status: "success", message: "You have signed out of this browser." }
        : params.error === "invalid_link"
          ? {
              status: "error",
              message:
                "That email link is invalid or expired. Request a new one.",
            }
          : undefined;
  return (
    <AccountFrame
      eyebrow="Your pastry account"
      title="Welcome back."
      description="Keep your orders together and your delivery details ready for next time."
    >
      <AccountAuthForm
        mode="login"
        configured={configured}
        returnTo={safeCustomerReturnPath(params.next)}
        pageMessage={message}
      />
    </AccountFrame>
  );
}
