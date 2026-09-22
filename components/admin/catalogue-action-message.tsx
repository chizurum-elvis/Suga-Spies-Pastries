import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { CatalogueActionState } from "@/lib/catalog/action-state";

export function CatalogueActionMessage({
  state,
}: {
  state: CatalogueActionState;
}) {
  if (state.status === "idle" || !state.message) return null;
  const success = state.status === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={
        success
          ? "border-sage-ink/20 bg-sage text-sage-ink flex gap-3 rounded-md border p-3 text-sm font-bold"
          : "border-critical-ink/20 bg-critical text-critical-ink flex gap-3 rounded-md border p-3 text-sm font-bold"
      }
      role={success ? "status" : "alert"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{state.message}</p>
    </div>
  );
}
