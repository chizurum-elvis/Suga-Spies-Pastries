import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

export function Skeleton({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-soft-pulse bg-border/65 rounded-md motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
