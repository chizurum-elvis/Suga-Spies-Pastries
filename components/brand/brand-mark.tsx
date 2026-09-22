import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
};

export function BrandMark({
  className,
  compact = false,
  inverted = false,
}: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label="Suga and Spies home"
      className={cn(
        "group inline-flex min-h-11 items-center rounded-md focus-visible:outline-offset-4",
        className,
      )}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border shadow-sm transition-transform duration-300 motion-safe:group-hover:scale-[1.025]",
          compact ? "size-11" : "size-15",
          inverted ? "border-white/24" : "border-brand/12",
        )}
        aria-hidden="true"
      >
        <Image
          src="/images/brand/suga-and-spies-logo.jpg"
          alt=""
          fill
          sizes={compact ? "44px" : "60px"}
          className="object-cover"
        />
      </span>
    </Link>
  );
}
