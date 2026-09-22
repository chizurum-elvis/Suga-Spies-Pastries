"use client";

import { useActionState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/action-state";

type RecoveryAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export function PasswordRecoveryForm({
  action,
  configured,
  pageMessage,
}: {
  action: RecoveryAction;
  configured: boolean;
  pageMessage?: AuthActionState;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFormMessage
        state={state.status === "idle" && pageMessage ? pageMessage : state}
      />

      <Field
        id="recovery-email"
        label="Owner email"
        description="We show the same confirmation whether or not an account matches this address."
        error={state.errors?.email}
        required
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.values?.email}
            disabled={!configured || pending || state.status === "success"}
            required
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!configured || state.status === "success"}
        isLoading={pending}
        loadingLabel="Requesting secure link…"
      >
        <MailCheck className="size-4.5" aria-hidden="true" />
        Send recovery link
      </Button>

      <Link
        href="/admin/login"
        className="text-ink-soft hover:text-brand-strong mx-auto inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to owner sign-in
      </Link>
    </form>
  );
}
