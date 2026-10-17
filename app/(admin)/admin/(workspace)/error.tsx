"use client";

import { StatePanel } from "@/components/ui/state-panel";

export default function AdminWorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <StatePanel
      tone="error"
      title="This section could not be loaded"
      description={
        error.digest
          ? `Please retry. If you just saved a change, check its current status before submitting again. Support reference: ${error.digest}.`
          : "Check the connection and retry. If you just saved a change, check its current status before submitting again."
      }
      onRetry={retry}
    />
  );
}
