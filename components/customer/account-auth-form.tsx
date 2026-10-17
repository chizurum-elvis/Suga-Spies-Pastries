"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/action-state";
import {
  registerCustomer,
  requestCustomerPasswordReset,
  signInCustomer,
  updateCustomerPassword,
} from "@/lib/customer/actions";

type Mode = "login" | "register" | "forgot" | "reset";
const actions = {
  login: signInCustomer,
  register: registerCustomer,
  forgot: requestCustomerPasswordReset,
  reset: updateCustomerPassword,
};

export function AccountAuthForm({
  mode,
  configured,
  returnTo = "/account",
  pageMessage,
}: {
  mode: Mode;
  configured: boolean;
  returnTo?: string;
  pageMessage?: AuthActionState;
}) {
  const [state, action, pending] = useActionState(
    actions[mode],
    initialAuthActionState,
  );
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!state.submissionId) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmRef.current) confirmRef.current.value = "";
  }, [state.submissionId]);
  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";
  const showConfirm = mode === "register" || mode === "reset";
  const pageState =
    state.status === "idle" && pageMessage ? pageMessage : state;
  const buttonText = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send recovery link",
    reset: "Update password",
  }[mode];

  return (
    <div className="max-w-lg">
      <form
        action={action}
        className="border-border bg-surface-raised grid gap-5 border p-5 sm:p-7"
        noValidate
      >
        <AuthFormMessage state={pageState} />
        {mode === "login" ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}
        {showEmail ? (
          <Field
            id={`customer-${mode}-email`}
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
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                disabled={!configured || pending}
              />
            )}
          </Field>
        ) : null}
        {showPassword ? (
          <Field
            id={`customer-${mode}-password`}
            label={mode === "login" ? "Password" : "New password"}
            description={
              mode === "register" || mode === "reset"
                ? "At least 12 characters, with uppercase, lowercase, a number and a symbol."
                : undefined
            }
            error={state.errors?.password}
            required
          >
            {(control) => (
              <Input
                {...control}
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                disabled={!configured || pending}
              />
            )}
          </Field>
        ) : null}
        {showConfirm ? (
          <Field
            id={`customer-${mode}-confirm`}
            label="Confirm password"
            error={state.errors?.confirmPassword}
            required
          >
            {(control) => (
              <Input
                {...control}
                ref={confirmRef}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={!configured || pending}
              />
            )}
          </Field>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={!configured}
          isLoading={pending}
          loadingLabel="Please wait…"
          className="w-full"
        >
          {buttonText}
        </Button>
        {mode === "login" ? (
          <div className="flex flex-wrap justify-between gap-3 text-sm">
            <Link
              href="/account/forgot-password"
              className="text-brand-strong font-bold underline underline-offset-4"
            >
              Forgot password?
            </Link>
            <Link
              href="/account/register"
              className="text-brand-strong font-bold underline underline-offset-4"
            >
              Create an account
            </Link>
          </div>
        ) : null}
        {mode === "register" ? (
          <p className="text-ink-soft text-sm leading-6">
            Already registered?{" "}
            <Link
              href="/account/login"
              className="text-brand-strong font-bold underline underline-offset-4"
            >
              Sign in
            </Link>
            . If your first email has expired,{" "}
            <Link
              href="/account/verify"
              className="text-brand-strong font-bold underline underline-offset-4"
            >
              request another link
            </Link>
            .
          </p>
        ) : null}
        {mode === "forgot" || mode === "reset" ? (
          <Link
            href="/account/login"
            className="text-brand-strong inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
          >
            Back to sign in
          </Link>
        ) : null}
      </form>
    </div>
  );
}
