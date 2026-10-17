import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame } from "@/components/customer/account-frame";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/catalog/presentation";
import { signOutCustomer } from "@/lib/customer/actions";
import { requireCustomerIdentity } from "@/lib/customer/identity";
import {
  connectVerifiedGuestOrders,
  getCustomerOrders,
  parseHistoryPage,
} from "@/lib/customer/orders";
import { getCustomerProfile } from "@/lib/customer/profile";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import { fulfillmentStage } from "@/lib/orders/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function CustomerAccount({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const identity = await requireCustomerIdentity();
  const params = await searchParams;
  const page = parseHistoryPage(params.page);
  let connectionFailed = false;
  try {
    await connectVerifiedGuestOrders(identity);
  } catch {
    connectionFailed = true;
  }
  const [historyResult, profileResult] = await Promise.allSettled([
    getCustomerOrders(identity, page),
    getCustomerProfile(identity),
  ]);
  const history =
    historyResult.status === "fulfilled" ? historyResult.value : null;
  const profile =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  return (
    <AccountFrame
      eyebrow="Your pastry account"
      title="Orders, all together."
      description="Your orders and the little details that make the next delivery easier."
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <p className="text-ink-soft min-w-0 text-sm break-words">
          Signed in as <strong className="text-ink">{identity.email}</strong>
        </p>
        <form action={signOutCustomer}>
          <button
            type="submit"
            className="text-brand-strong min-h-11 text-sm font-bold underline underline-offset-4"
          >
            Sign out
          </button>
        </form>
      </div>
      {params.error === "sign_out_failed" ? (
        <p
          role="alert"
          className="border-critical-ink/20 bg-critical text-critical-ink mb-5 border p-4 text-sm font-bold"
        >
          Sign-out could not be completed. Please retry.
        </p>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-labelledby="account-orders-heading" className="min-w-0">
          <div className="border-border mb-4 flex items-end justify-between gap-3 border-b pb-3">
            <h2
              id="account-orders-heading"
              className="font-display text-ink text-2xl"
            >
              Your orders
            </h2>
            <span className="text-ink-soft text-xs">Newest first</span>
          </div>
          {connectionFailed ? (
            <div
              role="status"
              className="border-warning-ink/20 bg-warning text-warning-ink mb-4 border p-4 text-sm leading-6"
            >
              Some older guest orders could not be connected just now. Refresh
              this page to retry; no existing order has been changed.
            </div>
          ) : null}
          {!history ? (
            <div
              role="alert"
              className="border-critical-ink/20 bg-critical text-critical-ink border p-5 text-sm"
            >
              <p className="font-bold">
                Order history is temporarily unavailable.
              </p>
              <Link
                href="/account"
                className="mt-3 inline-flex min-h-11 items-center underline"
              >
                Try again
              </Link>
            </div>
          ) : history.orders.length === 0 ? (
            <div className="border-border bg-butter-soft/45 border p-6">
              <p className="text-ink font-bold">No orders here yet.</p>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Orders placed with your verified email will appear here,
                including earlier guest orders. Guest links still work.
              </p>
              <Link
                href="/menu"
                className="text-brand-strong mt-4 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
              >
                Browse pastries
              </Link>
            </div>
          ) : (
            <>
              <ul className="border-border divide-border divide-y border-y">
                {history.orders.map((order) => (
                  <li key={order.id} className="py-5">
                    <Link
                      href={`/orders/${order.id}`}
                      className="group block rounded-sm outline-offset-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-ink group-hover:text-brand-strong font-bold">
                            {order.number}
                          </p>
                          <p className="text-ink-soft mt-1 text-xs">
                            Placed {formatBusinessDateTime(order.placedAt)}
                          </p>
                        </div>
                        <span className="text-brand-strong border-brand/25 bg-brand-soft/45 border px-2.5 py-1 text-xs font-bold">
                          {order.status === "cancelled"
                            ? "Cancelled"
                            : order.status === "discarded"
                              ? "Delivery closed"
                              : fulfillmentStage(order.fulfillmentStatus).label}
                        </span>
                      </div>
                      <p className="text-ink mt-3 text-sm font-semibold">
                        Delivery {formatLocalDateLabel(order.fulfillmentDate)}
                      </p>
                      <p className="text-ink-soft mt-1 line-clamp-2 text-sm">
                        {order.pastries.length
                          ? order.pastries.join(", ")
                          : "View order details"}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-ink text-sm font-bold tabular-nums">
                          {order.totalCents === null
                            ? "View total"
                            : formatCents(order.totalCents)}
                        </span>
                        <span className="text-brand-strong text-sm font-bold underline underline-offset-4">
                          Track order
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <nav
                aria-label="Order history pages"
                className="mt-5 flex justify-between gap-3 text-sm font-bold"
              >
                {page > 0 ? (
                  <Link
                    className="text-brand-strong inline-flex min-h-11 items-center underline"
                    href={page === 1 ? "/account" : `/account?page=${page - 1}`}
                  >
                    Newer orders
                  </Link>
                ) : (
                  <span />
                )}
                {history.hasMore ? (
                  <Link
                    className="text-brand-strong inline-flex min-h-11 items-center underline"
                    href={`/account?page=${page + 1}`}
                  >
                    Older orders
                  </Link>
                ) : null}
              </nav>
            </>
          )}
        </section>
        <aside className="border-border h-fit border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
          <h2 className="font-display text-ink text-xl">Next time, easier.</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            {profileResult.status === "rejected"
              ? "Saved details could not be loaded right now. You can retry on the details page."
              : profile
                ? "Your contact and delivery information is saved. We’ll recheck the address when you order."
                : "Save your contact and delivery information to fill the next checkout faster."}
          </p>
          <Link
            href="/account/details"
            className={`${buttonVariants({ variant: "secondary" })} mt-5 w-full`}
          >
            {profileResult.status === "rejected"
              ? "Retry saved details"
              : profile
                ? "Edit saved details"
                : "Save your details"}
          </Link>
          <p className="text-ink-faint mt-5 text-xs leading-5">
            Only orders using this verified email can be connected
            automatically. Need help with a different address? Contact support.
          </p>
        </aside>
      </div>
    </AccountFrame>
  );
}
