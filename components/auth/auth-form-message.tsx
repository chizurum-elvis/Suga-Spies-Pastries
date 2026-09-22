"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { AuthActionState } from "@/lib/auth/action-state";
import { cn } from "@/lib/utils/cn";

export function AuthFormMessage({ state }: { state: AuthActionState }) {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      messageRef.current?.focus();
    }
  }, [state.status, state.submissionId]);

  if (state.status === "idle" || !state.message) {
    return null;
  }

  const isError = state.status === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;

  return (
    <div
      ref={messageRef}
      tabIndex={-1}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm leading-6 outline-none",
        isError
          ? "border-critical-ink/20 bg-critical/70 text-critical-ink"
          : "border-sage-ink/20 bg-sage/70 text-sage-ink",
      )}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
      <p className="font-semibold">{state.message}</p>
    </div>
  );
}
