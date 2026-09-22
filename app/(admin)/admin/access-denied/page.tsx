import type { Metadata } from "next";
import { LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { signOutOwner } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Owner access unavailable",
};

type SearchParameters = Record<string, string | string[] | undefined>;

export default async function OwnerAccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const parameters = await searchParams;
  const reason = Array.isArray(parameters.reason)
    ? parameters.reason[0]
    : parameters.reason;
  const unavailable = reason === "unavailable";
  const sessionCloseFailed = reason === "session_close_failed";
  const passwordUpdatedSessionCloseFailed =
    reason === "password_updated_session_close_failed";
  const isSessionIssue =
    sessionCloseFailed || passwordUpdatedSessionCloseFailed;

  return (
    <AuthShell
      eyebrow="Security boundary"
      title={
        passwordUpdatedSessionCloseFailed
          ? "Your password changed, but this session stayed open."
          : sessionCloseFailed
            ? "This browser session could not be closed."
            : unavailable
              ? "Owner access could not be verified."
              : "This account cannot enter."
      }
      description="No customer, order, payment, or business data was loaded before this check completed."
    >
      <StatePanel
        tone={unavailable ? "neutral" : "error"}
        title={
          isSessionIssue
            ? "Close this browser before continuing"
            : unavailable
              ? "Verification service unavailable"
              : "Owner membership required"
        }
        description={
          passwordUpdatedSessionCloseFailed
            ? "The new password was saved, but the authentication provider could not safely close this browser session. Close every Suga Spies tab and this browser window before signing in again."
            : sessionCloseFailed
              ? "The authentication provider did not confirm sign-out. Close every Suga Spies tab and this browser window before trying again."
              : unavailable
                ? "The identity service responded, but the active owner allow-list could not be checked. Retry without changing any data."
                : "The signed-in identity is not an active member of the owner allow-list. Sign out before trying the approved account."
        }
        compact
        action={
          <div className="flex flex-wrap justify-center gap-3">
            {unavailable ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry verification
              </Link>
            ) : null}
            {!isSessionIssue ? (
              <form action={signOutOwner}>
                <Button
                  type="submit"
                  variant={unavailable ? "quiet" : "primary"}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </form>
            ) : null}
          </div>
        }
      />
    </AuthShell>
  );
}
