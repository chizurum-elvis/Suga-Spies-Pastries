"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en-CA">
      <body className="bg-canvas text-ink grid min-h-dvh place-items-center px-4 py-16">
        <main className="border-critical-ink/20 bg-surface-raised shadow-dialog w-full max-w-xl rounded-xl border p-6 text-center sm:p-10">
          <span className="bg-critical text-critical-ink mx-auto grid size-12 place-items-center rounded-full">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <h1 className="font-display mt-5 text-[2.15rem] leading-none">
            Suga Spies needs a fresh start
          </h1>
          <p className="text-ink-soft mt-4 text-sm leading-6">
            {error.digest
              ? `The application could not recover safely. Support reference: ${error.digest}.`
              : "The application could not recover safely. Please try loading it again."}
          </p>
          <Button className="mt-7" onClick={retry}>
            Try loading again
          </Button>
        </main>
      </body>
    </html>
  );
}
