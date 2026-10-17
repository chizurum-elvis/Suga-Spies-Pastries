import type { ReactNode } from "react";

export function AdminPageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
          {description}
        </p>
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-3">{action}</div>
      ) : null}
    </header>
  );
}
