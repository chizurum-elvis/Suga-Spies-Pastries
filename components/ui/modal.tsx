"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Modal({
  children,
  contentClassName,
  description,
  footer,
  title,
  trigger,
  open,
  onOpenChange,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/55 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in fixed inset-0 z-50 backdrop-blur-[2px] motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            "border-border bg-surface-raised shadow-dialog data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in fixed inset-x-0 bottom-0 z-50 max-h-[min(88dvh,48rem)] overflow-y-auto rounded-t-xl border p-5 motion-reduce:animate-none sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[min(calc(100%_-_2rem),36rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-7",
            contentClassName,
          )}
        >
          <div className="pr-10">
            <Dialog.Title className="font-display text-ink text-[1.9rem] leading-none sm:text-[2.1rem]">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-ink-soft mt-2 max-w-prose text-sm leading-6 sm:text-base">
                {description}
              </Dialog.Description>
            ) : null}
          </div>

          <Dialog.Close asChild>
            <Button
              variant="quiet"
              size="icon"
              className="absolute top-3 right-3 rounded-full"
              aria-label="Close dialog"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </Dialog.Close>

          <div className="mt-6">{children}</div>

          {footer ? (
            <div className="border-border mt-7 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalClose = Dialog.Close;
