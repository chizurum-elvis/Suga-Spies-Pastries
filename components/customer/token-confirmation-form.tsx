"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/lib/auth/action-state";
import {
  confirmCustomerEmail,
  confirmCustomerRecovery,
} from "@/lib/customer/actions";

export function TokenConfirmationForm({
  tokenHash,
  intent,
}: {
  tokenHash: string;
  intent: "signup" | "recovery";
}) {
  const [state, action, pending] = useActionState(
    intent === "signup" ? confirmCustomerEmail : confirmCustomerRecovery,
    initialAuthActionState,
  );
  return (
    <form
      action={action}
      className="border-border bg-surface-raised grid max-w-lg gap-5 border p-5 sm:p-7"
    >
      <AuthFormMessage state={state} />
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <p className="text-ink-soft text-sm leading-6">
        This extra step keeps email preview tools from using your one-time link
        before you do.
      </p>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        isLoading={pending}
        loadingLabel="Checking your link…"
      >
        {intent === "signup" ? "Verify my email" : "Continue securely"}
      </Button>
      <Link
        href={
          intent === "signup" ? "/account/verify" : "/account/forgot-password"
        }
        className="text-brand-strong inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
      >
        Request another link
      </Link>
    </form>
  );
}
