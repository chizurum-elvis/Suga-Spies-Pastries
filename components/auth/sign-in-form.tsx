"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import Link from "next/link";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/action-state";

type SignInAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type SignInFormProps = {
  action: SignInAction;
  configured: boolean;
  returnTo: string;
  pageMessage?: AuthActionState;
};

export function SignInForm({
  action,
  configured,
  pageMessage,
  returnTo,
}: SignInFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );
  const passwordRef = useRef<HTMLInputElement>(null);
  const visibleState =
    state.status === "idle" && pageMessage ? pageMessage : state;

  useEffect(() => {
    if (state.submissionId && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [state.submissionId]);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFormMessage state={visibleState} />

      <input type="hidden" name="returnTo" value={returnTo} />

      <Field
        id="owner-email"
        label="Owner email"
        error={state.errors?.email}
        required
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.values?.email}
            disabled={!configured || pending}
            required
          />
        )}
      </Field>

      <Field
        id="owner-password"
        label="Password"
        error={state.errors?.password}
        required
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            disabled={!configured || pending}
            required
          />
        )}
      </Field>

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/forgot-password"
          className="text-brand-strong hover:text-brand decoration-brand/30 rounded-sm text-sm font-bold underline underline-offset-4 transition-colors"
        >
          Forgot password?
        </Link>
        <span className="text-ink-faint hidden text-xs sm:inline">
          No public sign-up
        </span>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!configured}
        isLoading={pending}
        loadingLabel="Verifying owner access…"
      >
        <KeyRound className="size-4.5" aria-hidden="true" />
        Enter owner workspace
        <ArrowRight className="size-4.5" aria-hidden="true" />
      </Button>

      <p className="text-ink-faint text-center text-xs leading-5">
        Access attempts are handled by the configured authentication provider.
        Never share the owner password or recovery email.
      </p>
    </form>
  );
}
