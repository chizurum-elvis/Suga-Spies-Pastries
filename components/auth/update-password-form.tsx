"use client";

import { useActionState, useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/action-state";

type PasswordUpdateAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export function UpdatePasswordForm({
  action,
}: {
  action: PasswordUpdateAction;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.submissionId) {
      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmationRef.current) confirmationRef.current.value = "";
    }
  }, [state.submissionId]);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFormMessage state={state} />

      <Field
        id="new-password"
        label="New password"
        description="Use 12–128 characters with uppercase, lowercase, a number, and a symbol. Password managers and pasted passwords are supported."
        error={state.errors?.password}
        required
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            disabled={pending}
            required
          />
        )}
      </Field>

      <Field
        id="confirm-password"
        label="Confirm new password"
        error={state.errors?.confirmPassword}
        required
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            ref={confirmationRef}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            disabled={pending}
            required
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        isLoading={pending}
        loadingLabel="Securing owner account…"
      >
        <ShieldCheck className="size-4.5" aria-hidden="true" />
        Save new password
      </Button>
    </form>
  );
}
