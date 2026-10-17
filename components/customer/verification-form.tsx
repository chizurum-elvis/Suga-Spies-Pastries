"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { resendCustomerVerification } from "@/lib/customer/actions";

export function VerificationForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(
    resendCustomerVerification,
    initialAuthActionState,
  );
  return (
    <form
      action={action}
      noValidate
      className="border-border bg-surface-raised grid max-w-lg gap-5 border p-5 sm:p-7"
    >
      <AuthFormMessage state={state} />
      <Field
        id="verify-email"
        label="Email address"
        error={state.errors?.email}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            maxLength={254}
            required
            disabled={!configured || pending}
          />
        )}
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={!configured}
        isLoading={pending}
        loadingLabel="Sending…"
      >
        Send another link
      </Button>
      <Link
        href="/account/login"
        className="text-brand-strong inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </form>
  );
}
