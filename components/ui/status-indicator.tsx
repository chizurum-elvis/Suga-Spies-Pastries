import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock3,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

const statusStyles = {
  neutral: {
    icon: CircleDot,
    className: "border-border bg-canvas-strong text-ink-soft",
  },
  pending: {
    icon: Clock3,
    className: "border-warning-ink/20 bg-warning text-warning-ink",
  },
  active: {
    icon: CircleDot,
    className: "border-info-ink/20 bg-info text-info-ink",
  },
  success: {
    icon: CheckCircle2,
    className: "border-sage-ink/20 bg-sage text-sage-ink",
  },
  critical: {
    icon: AlertCircle,
    className: "border-critical-ink/20 bg-critical text-critical-ink",
  },
} satisfies Record<string, { icon: LucideIcon; className: string }>;

type StatusTone = keyof typeof statusStyles;

type StatusIndicatorProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusIndicator({
  className,
  label,
  tone = "neutral",
}: StatusIndicatorProps) {
  const status = statusStyles[tone];
  const Icon = status.icon;

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-extrabold",
        status.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
