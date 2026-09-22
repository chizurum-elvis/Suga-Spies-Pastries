"use client";

import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      closeButton
      visibleToasts={4}
      duration={5000}
      gap={10}
      icons={{
        success: (
          <CircleCheck className="text-sage-ink size-5" aria-hidden="true" />
        ),
        error: (
          <CircleX className="text-critical-ink size-5" aria-hidden="true" />
        ),
        info: <Info className="text-info-ink size-5" aria-hidden="true" />,
        warning: (
          <TriangleAlert
            className="text-warning-ink size-5"
            aria-hidden="true"
          />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border-border !bg-surface-raised !p-4 !text-ink !shadow-dialog",
          title: "!text-sm !font-extrabold !text-ink",
          description: "!text-sm !leading-5 !text-ink-soft",
          closeButton:
            "!border-border-strong !bg-surface-raised !text-ink hover:!bg-canvas-strong focus-visible:!outline-brand",
          actionButton: "!bg-brand !text-white hover:!bg-brand-strong",
          cancelButton: "!bg-canvas-strong !text-ink",
        },
      }}
    />
  );
}
