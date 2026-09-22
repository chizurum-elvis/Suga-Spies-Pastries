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
      title="The owner workspace did not load"
      description={
        error.digest
          ? `No changes were made. Retry this section or contact technical support with reference ${error.digest}.`
          : "No changes were made. Check the connection and retry this section."
      }
      onRetry={retry}
    />
  );
}
