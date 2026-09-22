"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Inbox,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const stateConfiguration = {
  loading: {
    icon: LoaderCircle,
    iconClassName: "animate-spin text-brand motion-reduce:animate-none",
    surfaceClassName: "border-border bg-surface",
  },
  empty: {
    icon: Inbox,
    iconClassName: "text-ink-soft",
    surfaceClassName: "border-border bg-surface",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-sage-ink",
    surfaceClassName: "border-sage-ink/20 bg-sage/65",
  },
  error: {
    icon: AlertTriangle,
    iconClassName: "text-critical-ink",
    surfaceClassName: "border-critical-ink/20 bg-critical/70",
  },
  neutral: {
    icon: CircleDashed,
    iconClassName: "text-info-ink",
    surfaceClassName: "border-info-ink/20 bg-info/65",
  },
} as const;

type StateTone = keyof typeof stateConfiguration;

type StatePanelProps = {
  tone: StateTone;
  title: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
};

export function StatePanel({
  action,
  className,
  compact = false,
  description,
  onRetry,
  retryLabel = "Try again",
  title,
  tone,
}: StatePanelProps) {
  const state = stateConfiguration[tone];
  const Icon = state.icon;
  const isAssertive = tone === "error";

  return (
    <section
      className={cn(
        "rounded-lg border text-center",
        compact ? "p-5" : "px-5 py-10 sm:px-8 sm:py-12",
        state.surfaceClassName,
        className,
      )}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-busy={tone === "loading" || undefined}
    >
      <Icon
        className={cn("mx-auto size-7", state.iconClassName)}
        aria-hidden="true"
      />
      <h2 className="text-ink mt-4 text-lg font-extrabold tracking-[-0.015em]">
        {title}
      </h2>
      <p className="text-ink-soft mx-auto mt-2 max-w-md text-sm leading-6">
        {description}
      </p>
      {onRetry || action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {onRetry ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
          {action}
        </div>
      ) : null}
    </section>
  );
}
