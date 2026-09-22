import type { ComponentPropsWithRef } from "react";
import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold tracking-[-0.01em] transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out select-none focus-visible:outline-3 focus-visible:outline-offset-3 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border-brand bg-brand text-white shadow-[0_8px_20px_rgb(97_35_91_/_18%)] hover:border-brand-strong hover:bg-brand-strong",
        secondary:
          "border-border-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft/45 hover:text-brand-strong",
        quiet:
          "border-transparent bg-transparent text-ink hover:bg-canvas-strong hover:text-brand-strong",
        destructive:
          "border-critical-ink bg-critical-ink text-white hover:bg-[#5f1714]",
      },
      size: {
        sm: "min-h-10 px-3.5",
        md: "px-5 py-2.5",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean;
    loadingLabel?: string;
  };

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  loadingLabel = "Working…",
  ref,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {isLoading ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
