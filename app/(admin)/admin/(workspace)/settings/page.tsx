import { AdminLink as Link } from "@/components/navigation/admin-link";
import { AdminPageHeading } from "@/components/admin/page-heading";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { DeliveryPricingForm } from "@/components/admin/delivery-pricing-form";
import { Card } from "@/components/ui/card";
import { requireOwnerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerEnvironment } from "@/lib/env/server";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { paymentWorkerWarnings } from "@/lib/admin/payment-health";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";

export default async function SettingsPage() {
  const owner = await requireOwnerSession("/admin/settings");
  const environment = getServerEnvironment();
  const db = await createServerSupabaseClient();
  const [business, delivery, history, worker] = await Promise.all([
    db.from("business_settings").select("*").eq("singleton", true).single(),
    db
      .from("delivery_settings")
      .select(
        "version,base_distance_meters,base_fee_cents,extra_km_fee_cents,maximum_distance_meters,free_delivery_threshold_cents",
      )
      .eq("singleton", true)
      .single(),
    db
      .from("business_settings_history")
      .select("version,accepting_orders,changed_at")
      .order("version", { ascending: false })
      .limit(5),
    environment.SUPABASE_SECRET_KEY
      ? createSecretSupabaseClient()
          .from("payment_worker_health")
          .select("checked_at")
          .eq("mode", environment.PAYMENTS_MODE === "live" ? "live" : "test")
          .abortSignal(AbortSignal.timeout(8_000))
          .maybeSingle()
      : { data: null, error: null },
  ]);
  if (business.error || delivery.error || history.error)
    throw new Error("Settings could not be loaded. Please retry.");
  const orderingWarnings = paymentWorkerWarnings(
    worker.data?.checked_at ?? null,
    Boolean(worker.error),
  );
  return (
    <div className="grid gap-7">
      <AdminPageHeading
        title="Settings"
        description="Manage ordering, delivery prices, alerts, and your account."
        action={
          getServerEnvironment().PAYMENTS_MODE === "live" ? undefined : (
            <Badge tone="warning">
              {getServerEnvironment().PAYMENTS_MODE === "test"
                ? "Test checkout — no real charges"
                : "Online checkout is disabled"}
            </Badge>
          )
        }
      />
      {orderingWarnings.length ? (
        <section
          aria-label="Online checkout checks"
          className="border-warning-ink/20 bg-warning/30 rounded-lg border p-5"
        >
          <h2>Online checkout needs attention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            {orderingWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <Link
            href="/admin/content"
            className="text-brand-strong mt-3 inline-flex min-h-11 items-center font-bold underline"
          >
            Review website policies
          </Link>
        </section>
      ) : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-6">
          <Card tone="admin">
            <h2>Orders and owner alerts</h2>
            <div className="mt-5">
              <BusinessSettingsForm
                settings={business.data}
                defaultAlertEmail={
                  getServerEnvironment().ORDER_ALERT_EMAIL ?? ""
                }
              />
            </div>
          </Card>
          <Card tone="admin" id="delivery-pricing">
            <h2>Delivery pricing</h2>
            <p className="text-ink-soft mt-2 mb-5 text-sm leading-6">
              Toronto, Markham, and Mississauga only. New prices apply to new
              quotes; existing paid orders keep their original price.
            </p>
            <DeliveryPricingForm
              key={delivery.data.version}
              settings={delivery.data}
            />
          </Card>
          <Card tone="admin">
            <h2>Recent settings changes</h2>
            {history.data.length ? (
              <ul className="divide-border mt-3 divide-y">
                {history.data.map((entry) => (
                  <li key={entry.version} className="py-3 text-sm">
                    <span className="font-bold">
                      {entry.accepting_orders
                        ? "Settings saved · Ordering enabled"
                        : "Settings saved · Ordering paused"}
                    </span>
                    <p className="text-ink-soft mt-1 text-xs">
                      {formatBusinessDateTime(entry.changed_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft mt-3 text-sm">
                No settings changes yet.
              </p>
            )}
          </Card>
        </div>
        <div className="grid min-w-0 gap-6">
          <Card tone="admin">
            <h2>Your account</h2>
            <p className="mt-3 font-bold">{owner.displayName ?? "Owner"}</p>
            <p className="text-ink-soft mt-1 text-sm">{owner.email}</p>
            <Link
              href="/admin/forgot-password"
              className="text-brand-strong mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
            >
              Change password securely
            </Link>
            <p className="text-ink-soft mt-2 text-xs leading-5">
              A private recovery link will be sent to your sign-in email. Never
              share your password.
            </p>
          </Card>
          <Card tone="admin">
            <h2>A simple daily routine</h2>
            <ol className="text-ink-soft mt-4 list-decimal space-y-3 pl-4 text-sm leading-6">
              <li>
                Check Overview for deliveries and anything needing attention.
              </li>
              <li>
                Use Kitchen plan to bake and pack, then update each order in
                Orders.
              </li>
              <li>
                Mark orders delivered only after a successful delivery. Use
                “Delivery failed” when an attempt fails.
              </li>
              <li>
                Keep sold-out pastries unavailable in Menu and block days off in
                Delivery calendar.
              </li>
              <li>Save and publish website changes in Website content.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
