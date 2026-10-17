# Running the bakery from admin

Sign in at your website's `/admin/login` using your approved owner account.
On a phone, open the menu button to see all seven sections. Dates and deadlines
use Toronto time, even if you are travelling.

## Overview — start here each day

Check today's deliveries, orders awaiting preparation, available delivery spaces,
and anything needing attention. Open a count or link to see its records. Test
orders are not real customer orders; use **Show live orders** for daily work.
Sales summaries are not profit or the amount Stripe has paid into your bank.

## Orders — follow each customer's order

Search with an order number, customer name, email, or phone. Use the delivery-date,
stage, and payment filters to narrow the list. Open an order to see pastries,
quantities, delivery details, payment/refund information, emails, and history.

Move an order forward only when that work has happened: received → being prepared
→ ready → out for delivery → delivered. Preparing an order prevents cancellation.
Do not mark something delivered merely to clear the list.

Eligible cancellation closes the order, releases its delivery space, and requests
the full refund. The refund may still be processing at the bank. Read its status
before promising the customer that the money has arrived. A cancellation must
arrive before the displayed cutoff and before preparation starts.

If a delivery fails, record what happened and whether the issue was ours or the
customer's. The customer has 24 hours to respond. You choose the redelivery date
after their address is confirmed. Do not send a paid redelivery until its required
fee is confirmed. Use the final delivered/failed outcome so the correct closure
and refund rules run. There is no pickup fallback.

Phone/Instagram order entry records items and uses a delivery space. It does not
charge a card or prove payment; those records are labelled separately from paid
website orders. Never treat an unpaid record as a Stripe payment confirmation.

## Kitchen plan — what to bake and pack

Choose the delivery date or date range. The plan groups the paid orders into
pastry quantities and selected options. Print it for the kitchen. Off-site records
and capacity-only reservations are separate, so an unpaid record is not mistaken
for a paid website order. Use Orders to update preparation and delivery stages.

## Menu — what customers can buy

Open a pastry to change its photo, description, ingredients, allergen information,
price, choices, or availability. Prices are per item, not the total for four.
Regular cheesecake has a minimum of one; the other current products have a
minimum of four, then increase one at a time.

Use unavailable when a published pastry is temporarily sold out. Draft items are
not ready for customers; archived items are no longer offered. Paid orders keep
their original prices and selections when you edit the menu.

Only publish ingredients and allergen wording you have checked against your real
recipes, packaged ingredients, substitutions, and shared-kitchen conditions.
Do not copy ingredient guesses from a photograph.

## Delivery calendar — your working dates

Review bookings and reserve days off with a date block. Wednesday, Sunday, and
December 25 are closed automatically. There are four delivery spaces per day,
shared by website and off-site orders, with no override.

Blocking a date does not cancel existing orders. If the system warns about
existing commitments, review those orders and contact customers as needed.

## Website content — what customers read

Choose Homepage, Contact details, Frequently asked questions, or a policy.
**Save draft** keeps your changes private. Review them, then **Publish version**
to make them public. Check the relevant customer page in another tab afterwards.
History lets you restore an older version as a draft before publishing it again.

Have policy wording approved before publishing it. Do not publish an empty or
unfinished policy simply to make checkout available.

## Settings — ordering, prices, and alerts

Check the owner alert inbox and delivery prices. Pausing new orders prevents new
website checkout; it does not cancel existing orders or stop their refunds.
The password link sends a private recovery email. Keep your password private.

If you see an automatic-payment warning, contact technical support. Do not hide
the warning or repeatedly restart a customer's payment.

## When something needs attention

- **Email waiting:** it is queued, not proof of inbox delivery.
- **Email sent:** the email service accepted it; the customer's inbox or spam
  filter may still reject it. Check Resend's delivery status when investigating.
- **Email failed:** use the retry control when offered. If it says the safe retry
  window has ended, contact the customer instead of repeatedly resending.
- **Refund processing:** the order is closed, but the money is still being
  returned. **Refund needs attention** requires a provider check, not another
  manual refund made without checking the original reference.
- **Information changed in another tab:** refresh and review the latest version
  before saving again. Your older form must not overwrite newer information.

For support, share the order number, what you tried, and when it happened.
Do not share passwords, secret keys, payment-card details, or a customer's private
order-access link. Sign out after using a shared device.
