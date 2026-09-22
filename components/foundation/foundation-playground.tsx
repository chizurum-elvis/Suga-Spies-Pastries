"use client";

import type { FormEvent } from "react";
import { CalendarDays, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, ModalClose } from "@/components/ui/modal";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusIndicator } from "@/components/ui/status-indicator";

export function FoundationPlayground() {
  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.success("Example saved", {
      description: "This confirms the accessible success-message foundation.",
    });
  }

  return (
    <div className="grid gap-12">
      <section aria-labelledby="controls-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-brand text-xs font-extrabold tracking-[0.14em] uppercase">
              Interaction primitives
            </p>
            <h2
              id="controls-heading"
              className="mt-2 text-2xl font-extrabold tracking-[-0.03em]"
            >
              Controls and confirmation
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Draft</Badge>
            <Badge tone="accent">Customization</Badge>
            <Badge tone="success">Available</Badge>
            <Badge tone="warning">Action needed</Badge>
            <Badge tone="critical">Unavailable</Badge>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => toast.success("Order detail saved")}>
            Primary action
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.info("Nothing was changed")}
          >
            Secondary
          </Button>
          <Button variant="quiet">Quiet action</Button>
          <Button variant="destructive">Destructive</Button>
          <Button isLoading loadingLabel="Saving example">
            Loading
          </Button>
          <Modal
            title="Confirm this example"
            description="Important actions use a focused dialog with a clear consequence and a safe way back."
            trigger={
              <Button variant="secondary">
                <CalendarDays className="size-4" aria-hidden="true" />
                Open dialog
              </Button>
            }
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="secondary">Go back</Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button
                    onClick={() =>
                      toast.success("Example confirmed", {
                        description:
                          "The dialog closed and focus returned safely.",
                      })
                    }
                  >
                    Confirm example
                  </Button>
                </ModalClose>
              </>
            }
          >
            <p className="text-ink-soft text-sm leading-6">
              The final product will replace this example with the exact order,
              amount, date, time, and consequence being confirmed.
            </p>
          </Modal>
        </div>
      </section>

      <section aria-labelledby="form-heading">
        <h2
          id="form-heading"
          className="text-2xl font-extrabold tracking-[-0.03em]"
        >
          Form foundation
        </h2>
        <Card tone="raised" className="mt-6 max-w-3xl">
          <form onSubmit={handleFormSubmit} noValidate className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="foundation-name"
                label="Customer name"
                description="Use the name for the order handoff."
                required
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. Ada Okafor"
                    required
                  />
                )}
              </Field>
              <Field id="foundation-method" label="Fulfillment method" required>
                {(controlProps) => (
                  <Select
                    {...controlProps}
                    name="method"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    <option value="delivery">Delivery</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field
              id="foundation-notes"
              label="Example notes"
              description="Structured options will be used for required choices. Notes are only for helpful context."
            >
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  name="notes"
                  maxLength={300}
                  placeholder="Add useful context for the owner"
                />
              )}
            </Field>
            <Field
              id="foundation-error"
              label="Error example"
              error="Choose an available delivery date before continuing."
            >
              {(controlProps) => (
                <Input {...controlProps} value="4:00 p.m." readOnly />
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit">
                <Send className="size-4" aria-hidden="true" />
                Test confirmation toast
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section aria-labelledby="status-heading">
        <h2
          id="status-heading"
          className="text-2xl font-extrabold tracking-[-0.03em]"
        >
          Status language
        </h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusIndicator label="Order received" tone="active" />
          <StatusIndicator label="Preparing" tone="pending" />
          <StatusIndicator label="Ready" tone="success" />
          <StatusIndicator label="Delivery issue" tone="critical" />
        </div>
      </section>

      <section aria-labelledby="states-heading">
        <h2
          id="states-heading"
          className="text-2xl font-extrabold tracking-[-0.03em]"
        >
          Resilient states
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <StatePanel
            tone="loading"
            title="Loading available times"
            description="Checking Toronto-time availability and daily capacity."
          />
          <StatePanel
            tone="empty"
            title="No orders here yet"
            description="New orders will appear here after verified payment confirmation."
          />
          <StatePanel
            tone="success"
            title="Order detail saved"
            description="The updated information is ready for the next step."
          />
          <StatePanel
            tone="error"
            title="We couldn’t load this section"
            description="Your information is still safe. Check the connection and try again."
            retryLabel="Retry example"
            onRetry={() => toast.info("Retry requested")}
          />
        </div>
      </section>
    </div>
  );
}
