"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function StorefrontError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <StatePanel
        tone="error"
        title="This page needs another try"
        description={
          error.digest
            ? `We couldn’t finish loading this page. Your information is safe. Support reference: ${error.digest}.`
            : "We couldn’t finish loading this page. Your information is safe. Please try again."
        }
        onRetry={retry}
        action={
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            Return home
          </Link>
        }
      />
    </div>
  );
}
