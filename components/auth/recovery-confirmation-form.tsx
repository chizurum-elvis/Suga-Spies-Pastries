"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/action-state";

type RecoveryConfirmationAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export function RecoveryConfirmationForm({
  action,
  tokenHash,
}: {
  action: RecoveryConfirmationAction;
  tokenHash: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <AuthFormMessage state={state} />
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="type" value="recovery" />

      <div className="border-border bg-canvas-soft rounded-md border p-4">
        <p className="text-ink text-sm leading-6 font-semibold">
          This extra confirmation prevents email preview tools from using the
          one-time link before you do.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        isLoading={pending}
        loadingLabel="Verifying secure link…"
      >
        <ShieldCheck className="size-4.5" aria-hidden="true" />
        Continue securely
      </Button>

      <Link
        href="/admin/forgot-password"
        className="text-ink-soft hover:text-brand-strong mx-auto inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold underline underline-offset-4 transition-colors"
      >
        Request a different recovery link
      </Link>
    </form>
  );
}
