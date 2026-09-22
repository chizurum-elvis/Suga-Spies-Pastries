import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { requestOwnerPasswordReset } from "@/lib/auth/actions";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Recover owner access",
};

export default function ForgotOwnerPasswordPage() {
  const configured = getSupabaseConfigurationState().status === "configured";

  return (
    <AuthShell
      eyebrow="Secure recovery"
      title="Recover owner access."
      description="Request one time-limited link for the approved owner email. For privacy, this screen never confirms whether an address has an account."
    >
      <PasswordRecoveryForm
        action={requestOwnerPasswordReset}
        configured={configured}
        pageMessage={
          configured
            ? undefined
            : {
                status: "error",
                message:
                  "Password recovery is unavailable until Supabase is configured.",
              }
        }
      />
    </AuthShell>
  );
}
