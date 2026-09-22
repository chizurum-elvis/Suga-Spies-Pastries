import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-5 font-bold",
  {
    variants: {
      tone: {
        neutral: "border-border bg-canvas-strong text-ink-soft",
        accent: "border-brand/20 bg-brand-soft text-brand-strong",
        success: "border-sage-ink/20 bg-sage text-sage-ink",
        info: "border-info-ink/20 bg-info text-info-ink",
        warning: "border-warning-ink/20 bg-warning text-warning-ink",
        critical: "border-critical-ink/20 bg-critical text-critical-ink",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

type BadgeProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
