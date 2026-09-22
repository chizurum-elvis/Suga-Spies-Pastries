import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FieldProps = {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (controlProps: FieldControlProps) => ReactNode;
};

export function Field({
  children,
  className,
  description,
  error,
  id,
  label,
  required = false,
}: FieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-ink text-sm leading-5 font-bold">
        {label}
        {required ? (
          <span className="text-brand ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {description ? (
        <p id={descriptionId} className="text-ink-soft text-sm leading-5">
          {description}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p
          id={errorId}
          className="text-critical-ink text-sm leading-5 font-semibold"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClassName =
  "min-h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 py-2.5 text-base text-ink shadow-[inset_0_1px_0_rgb(36_25_22_/_3%)] transition-[border-color,box-shadow] placeholder:text-ink-faint hover:border-ink-faint focus:border-brand focus:outline-none focus-visible:ring-3 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-canvas-strong disabled:text-ink-faint aria-invalid:border-critical-ink aria-invalid:ring-3 aria-invalid:ring-critical/70";

export function Input({
  className,
  ref,
  ...props
}: ComponentPropsWithRef<"input">) {
  return (
    <input ref={ref} className={cn(controlClassName, className)} {...props} />
  );
}

export function Textarea({
  className,
  ref,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClassName, "min-h-28 resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ref,
  ...props
}: ComponentPropsWithRef<"select">) {
  return (
    <select ref={ref} className={cn(controlClassName, className)} {...props} />
  );
}
