"use client";

import { AuthShell } from "@/components/auth/auth-shell";
import { StatePanel } from "@/components/ui/state-panel";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <AuthShell
      eyebrow="Owner access"
      title="The private workspace did not load."
      description="No order or business data was changed. The error is contained to this owner-only route."
    >
      <StatePanel
        tone="error"
        title="Please try the secure route again"
        description={
          error.digest
            ? `Retry the route or provide technical support with reference ${error.digest}.`
            : "Check the connection and retry. If the problem continues, contact technical support."
        }
        onRetry={retry}
        compact
      />
    </AuthShell>
  );
}
