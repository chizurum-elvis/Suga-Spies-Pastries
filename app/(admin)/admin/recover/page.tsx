import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryConfirmationForm } from "@/components/auth/recovery-confirmation-form";
import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { confirmOwnerPasswordRecovery } from "@/lib/auth/actions";
import { passwordRecoveryTokenSchema } from "@/lib/auth/validation";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Confirm password recovery",
};

type SearchParameters = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OwnerRecoveryConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const parameters = await searchParams;
  const recoveryLink = passwordRecoveryTokenSchema.safeParse({
    tokenHash: firstValue(parameters.token_hash),
    type: firstValue(parameters.type),
  });

  return (
    <AuthShell
      eyebrow="Owner account recovery"
      title="Confirm before using this one-time link."
      description="Only continue if you requested a password reset for the approved Suga Spies owner account."
    >
      {recoveryLink.success ? (
        <RecoveryConfirmationForm
          action={confirmOwnerPasswordRecovery}
          tokenHash={recoveryLink.data.tokenHash}
        />
      ) : (
        <StatePanel
          tone="error"
          title="Recovery link unavailable"
          description="This link is incomplete or invalid. Request a new recovery email before trying again."
          compact
          action={
            <Link
              href="/admin/forgot-password"
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              Request a new link
            </Link>
          }
        />
      )}
    </AuthShell>
  );
}
