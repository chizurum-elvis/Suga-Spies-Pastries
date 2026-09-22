import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { signInOwner } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/action-state";
import { sanitizeAdminReturnPath } from "@/lib/auth/paths";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Owner sign-in",
};

type SearchParameters = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPageMessage(
  parameters: SearchParameters,
  configured: boolean,
): AuthActionState | undefined {
  if (!configured) {
    return {
      status: "error",
      message:
        "Owner sign-in is unavailable until the Supabase public URL and publishable key are configured.",
    };
  }

  const message = firstValue(parameters.message);
  const error = firstValue(parameters.error);

  if (message === "signed_out") {
    return {
      status: "success",
      message: "You have been signed out of this browser.",
    };
  }

  if (message === "password_updated") {
    return {
      status: "success",
      message: "Your password was updated. Sign in with the new password.",
    };
  }

  if (error === "auth_required") {
    return {
      status: "error",
      message: "Sign in with the approved owner account to continue.",
    };
  }

  if (error === "invalid_link") {
    return {
      status: "error",
      message:
        "That authentication link is invalid or expired. Request a new recovery link.",
    };
  }

  if (error === "configuration") {
    return {
      status: "error",
      message:
        "Owner authentication has not been configured for this environment.",
    };
  }

  return undefined;
}

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const parameters = await searchParams;
  const configured = getSupabaseConfigurationState().status === "configured";
  const returnTo = sanitizeAdminReturnPath(firstValue(parameters.next));

  return (
    <AuthShell
      eyebrow="Private owner access"
      title="Welcome back to the kitchen side."
      description="Sign in with the single approved owner account. Customers never need this page to browse, order, pay, or track pastries."
    >
      <SignInForm
        action={signInOwner}
        configured={configured}
        returnTo={returnTo}
        pageMessage={getPageMessage(parameters, configured)}
      />
    </AuthShell>
  );
}
