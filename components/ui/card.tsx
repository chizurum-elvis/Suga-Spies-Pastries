import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const cardVariants = cva("border", {
  variants: {
    tone: {
      default: "border-border bg-surface",
      raised: "border-border bg-surface-raised shadow-soft",
      tinted: "border-brand/15 bg-brand-soft/45",
      butter: "border-warning/80 bg-butter-soft",
      admin: "border-border bg-white",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
    },
    radius: {
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "md",
    radius: "lg",
  },
});

type CardProps = ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof cardVariants>;

export function Card({
  className,
  padding,
  radius,
  tone,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(cardVariants({ tone, padding, radius }), className)}
      {...props}
    />
  );
}
