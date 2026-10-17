"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  advanceExternalOrder,
  type ExternalActionState,
} from "@/lib/production/external-actions";

const initial: ExternalActionState = {
  status: "idle",
  message: "",
  submissionId: "",
};
const nextStage: Record<string, { value: string; label: string }> = {
  received: { value: "preparing", label: "Start preparing" },
  preparing: { value: "ready", label: "Mark ready" },
  ready: { value: "out_for_delivery", label: "Mark out for delivery" },
  out_for_delivery: { value: "delivered", label: "Mark delivered" },
};

export function ExternalOrderStage({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    advanceExternalOrder,
    initial,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status, state.submissionId]);
  const next = nextStage[status];
  if (!next) return null;
  return (
    <div className="grid gap-3">
      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-sm font-semibold"
        >
          {state.message}
        </p>
      ) : null}
      <form action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <Button
          type="submit"
          name="next"
          value={next.value}
          isLoading={pending}
        >
          {next.label}
        </Button>
        {status === "received" ? (
          <Button
            type="submit"
            name="next"
            value="cancelled"
            variant="destructive"
            isLoading={pending}
            onClick={(event) => {
              if (
                !window.confirm(
                  "Cancel this external order and release its daily space?",
                )
              )
                event.preventDefault();
            }}
          >
            Cancel order
          </Button>
        ) : null}
      </form>
    </div>
  );
}
