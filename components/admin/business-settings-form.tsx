"use client";
import { useActionState } from "react";
import { saveBusinessSettings } from "@/lib/admin/settings-actions";
import { initialSettingsState } from "@/lib/admin/settings-schema";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function BusinessSettingsForm({
  settings,
  defaultAlertEmail,
}: {
  settings: Database["public"]["Tables"]["business_settings"]["Row"];
  defaultAlertEmail: string;
}) {
  const [state, action, pending] = useActionState(
    saveBusinessSettings,
    initialSettingsState,
  );
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="version" value={settings.version} />
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error" ? "text-critical-ink" : "text-sage-ink"
          }
        >
          {state.message}
        </p>
      ) : null}
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="acceptingOrders"
          defaultChecked={settings.accepting_orders}
          className="accent-brand mt-1 size-4"
        />
        <span>
          <strong className="block">Accept new website orders</strong>
          <span className="text-ink-soft mt-1 block text-sm leading-5">
            Turn off when you need a break. Existing orders and refunds are not
            affected.
          </span>
        </span>
      </label>
      <Field
        id="pause-message"
        label="Message when ordering is paused"
        required
      >
        {(props) => (
          <Textarea
            {...props}
            name="pauseMessage"
            defaultValue={settings.pause_message}
            minLength={10}
            maxLength={240}
            required
            className="min-h-24"
          />
        )}
      </Field>
      <Field
        id="alert-email"
        label="Email for owner alerts"
        description={`Use an inbox you control; alerts include customer order details. Leave blank to use ${defaultAlertEmail || "the configured business email"}. Important alerts remain enabled.`}
      >
        {(props) => (
          <Input
            {...props}
            type="email"
            name="ownerAlertEmail"
            defaultValue={settings.owner_alert_email ?? ""}
            maxLength={254}
            autoComplete="email"
          />
        )}
      </Field>
      <Button
        type="submit"
        disabled={pending}
        isLoading={pending}
        loadingLabel="Saving…"
        className="justify-self-start"
      >
        Save settings
      </Button>
    </form>
  );
}
