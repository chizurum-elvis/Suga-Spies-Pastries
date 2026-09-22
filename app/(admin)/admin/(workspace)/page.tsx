import {
  CalendarCheck2,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business";

const readinessItems = [
  {
    title: "Owner access",
    description:
      "Identity, active owner membership, and route access are verified on the server",
    icon: ShieldCheck,
    status: "Protected",
    tone: "success" as const,
  },
  {
    title: "Business scheduling",
    description: `Live dates, blackouts, and four-order capacity are evaluated in ${BUSINESS_TIME_ZONE}`,
    icon: CalendarCheck2,
    status: "Connected",
    tone: "success" as const,
  },
  {
    title: "Paid orders",
    description:
      "Verified paid orders and delivery details are available only inside the protected owner workspace",
    icon: ShoppingBag,
    status: "Connected",
    tone: "success" as const,
  },
] as const;

export default function AdminPage() {
  return (
    <div className="grid gap-8">
      <header
        id="overview"
        className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Protected owner workspace</Badge>
            <Badge>Order data protected</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Owner workspace
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6 sm:text-base">
            Owner access, menu operations, fulfillment availability, and paid
            order records are connected. Production planning remains a later
            vertical slice.
          </p>
        </div>
        <StatusIndicator label="Access verified" tone="success" />
      </header>

      <section aria-labelledby="readiness-heading">
        <h2
          id="readiness-heading"
          className="text-lg font-extrabold tracking-[-0.02em]"
        >
          System readiness
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {readinessItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} tone="admin" className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <span className="bg-canvas-strong text-brand-strong grid size-10 shrink-0 place-items-center rounded-md">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <StatusIndicator label={item.status} tone={item.tone} />
                </div>
                <h3 className="text-ink mt-5 font-extrabold">{item.title}</h3>
                <p className="text-ink-soft mt-2 text-sm leading-6">
                  {item.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="orders" aria-labelledby="orders-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2
            id="orders-heading"
            className="text-lg font-extrabold tracking-[-0.02em]"
          >
            Orders
          </h2>
          <Badge tone="accent">Connected</Badge>
        </div>
        <Card tone="admin" padding="lg">
          <p className="text-ink-soft text-sm leading-6">
            Open confirmed orders, delivery details, payment exceptions, and
            email-delivery status. Test orders are marked clearly.
          </p>
          <Link
            href="/admin/orders"
            className="text-brand-strong mt-4 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
          >
            View pastry orders
          </Link>
        </Card>
      </section>

      <section
        id="production"
        aria-labelledby="production-heading"
        className="grid gap-4 lg:grid-cols-2"
      >
        <Card tone="admin" padding="lg">
          <h2
            id="production-heading"
            className="text-lg font-extrabold tracking-[-0.02em]"
          >
            Production view
          </h2>
          <p className="text-ink-soft mt-3 text-sm leading-6">
            Future production totals will be derived from paid, non-cancelled
            orders and grouped by product, flavour, delivery date, and
            fulfillment mode.
          </p>
        </Card>
        <Card id="availability" tone="admin" padding="lg">
          <h2 className="text-lg font-extrabold tracking-[-0.02em]">
            Availability
          </h2>
          <p className="text-ink-soft mt-3 text-sm leading-6">
            The protected availability calendar now combines closures, manual
            blackouts, external orders, active holds, and the hard daily limit.
          </p>
          <Link
            href="/admin/availability"
            className="text-brand-strong mt-4 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
          >
            Manage availability
          </Link>
        </Card>
      </section>

      <section id="settings" aria-labelledby="settings-heading">
        <Card tone="admin" padding="lg">
          <div className="flex items-start gap-4">
            <span className="bg-brand-soft text-brand-strong grid size-10 shrink-0 place-items-center rounded-md">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="settings-heading"
                className="text-lg font-extrabold tracking-[-0.02em]"
              >
                Security boundary
              </h2>
              <p className="text-ink-soft mt-2 max-w-3xl text-sm leading-6">
                The owner identity is verified through Supabase Auth and an
                active database allow-list protected by Row Level Security.
                Every future data action must still repeat authorization near
                its query or mutation and write an appropriate audit record.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
