# Suga Spies Pastry Ordering Platform

## Product Requirements Document

> **Current implementation override (September 14, 2026):** Checkout does not calculate, display, or collect tax. Any tax requirements retained in this older draft are historical and are superseded by `docs/business-owner-discovery-responses.md`. The payable total is the authoritative pastry subtotal plus the confirmed delivery fee.

| Field | Value |
| --- | --- |
| Product name | Suga Spies — working title; confirm with business owner |
| Document status | Draft for business-owner review |
| Version | 0.1 |
| Last updated | August 27, 2026 |
| Product owner | Business owner — TBD |
| Project/engineering owner | TBD |
| Approvers | Business owner; engineering owner; tax/legal advisers where applicable |
| Target market | Canada; exact province and city TBD |
| Target release | TBD |

### Revision history

| Version | Date | Author | Summary |
| --- | --- | --- | --- |
| 0.1 | August 27, 2026 | Project team | Initial end-to-end product requirements draft |

### Approval record

Approval means the reviewer agrees that confirmed rules are accurate, proposed rules may be used for implementation, and all launch-blocking TBDs have been resolved.

| Reviewer | Role | Status | Date | Notes |
| --- | --- | --- | --- | --- |
| TBD | Business owner | Pending | — | — |
| TBD | Engineering owner | Pending | — | — |
| TBD | Tax adviser/accountant | Pending | — | Product and package tax matrix only |
| TBD | Legal/compliance reviewer, if engaged | Pending | — | Policies and provincial requirements only |

---

## 1. Executive summary

Suga Spies is a mobile-first pastry ordering platform for a Canadian pastry business. Customers will browse the menu, select valid quantities, choose a future delivery date and time window, enter a serviceable delivery address, pay using Apple Pay or Interac e-transfer, receive confirmation, and track fulfillment progress. An ordinary-card fallback is proposed but not yet approved. Account creation is optional.

The owner will use an authenticated admin portal to manage products, prices, availability, website content, schedules, blackout dates, daily capacity, orders, payments, refunds, and fulfillment updates. Status changes will produce customer-visible timeline events and transactional emails.

The system must protect the business from accepting work it cannot fulfill. The browser may preview availability, but the server and database are authoritative for price, product availability, quantity rules, delivery eligibility, taxes, payment state, cancellation eligibility, and capacity. Concurrent checkouts must never produce more confirmed orders than the configured capacity.

This PRD is intentionally explicit about unresolved business decisions. Engineering must not silently invent policy for any item marked **TBD — launch blocker**.

---

## 2. Business context and problem statement

Customers need a trustworthy way to order pastries for future events without relying entirely on manual messages. They must know, before paying, whether an item, delivery area, fulfillment date, and time window are permitted. After paying, they need clear confirmation and progress updates.

The owner needs one operational source of truth for:

- What was ordered and at what historical price.
- Whether payment was actually received.
- Which fulfillment dates are open, blocked, held, or full.
- What must be produced for each date/window.
- Where each order is in preparation and delivery.
- Which messages were sent to the customer.
- Who made sensitive administrative changes.

Without a transactional capacity model, two customers could pay for the final available place simultaneously. Without a separate payment model, a browser success page or customer-provided screenshot could incorrectly confirm an unpaid order. These are primary product risks, not implementation details.

---

## 3. Product goals and success measures

### 3.1 Goals

1. Let a guest or signed-in customer complete a valid future pastry order from a mobile or desktop browser.
2. Prevent selection and confirmation of unavailable products, invalid quantities, blocked fulfillment windows, unsupported addresses, and full dates.
3. Reliably associate every successful payment with one order.
4. Give customers secure, understandable payment and fulfillment tracking.
5. Let the owner operate the store without needing a developer for routine menu, schedule, content, order, or availability changes.
6. Preserve accurate historical financial and order information after products, prices, addresses, policies, or tax rules change.
7. Meet the applicable Canadian tax, food-information, consumer, privacy, email, and accessibility obligations before launch.

### 3.2 Launch guardrails

| Measure | Launch target |
| --- | --- |
| Confirmed orders above configured capacity | 0 |
| Duplicate confirmed orders or duplicate charges caused by retries | 0 |
| Cross-customer unauthorized order access | 0 |
| Payments marked paid without provider/bank/admin verification | 0 |
| Payment callbacks processed without signature/authenticity validation | 0 |
| Paid orders missing from the admin portal after successful processing | 0 |
| Critical status events without an audit/timeline record | 0 |
| Payment-confirmed order visible to admin | Within 60 seconds under normal operation |
| Transactional email job queued after a triggering event | Within 60 seconds under normal operation |
| Core customer journeys meeting agreed accessibility level | 100% before launch |

### 3.3 Post-launch metrics

The first 30 days will establish baselines before aggressive commercial targets are set.

- Menu-to-cart conversion rate.
- Checkout-start and checkout-completion rate.
- Abandonment rate by checkout step.
- Payment success rate by payment method.
- Percentage of attempted dates rejected by reason.
- Average order value and average pieces per order.
- Repeat-customer rate.
- Cancellation and refund rates.
- Orders delivered on time.
- Average owner time required to reconcile an e-transfer.
- Support contacts per completed order.
- Email delivery failure rate.

---

## 4. Non-goals for the first release

Unless the business owner explicitly reprioritizes them, the MVP excludes:

- Native iOS or Android applications.
- Multiple stores, kitchens, vendors, currencies, or countries.
- Customer pickup.
- International delivery.
- Same-day and rush ordering.
- Live driver GPS, route planning, or a driver application.
- Ingredient inventory, recipe costing, supplier procurement, POS, or accounting integrations.
- Loyalty points, gift cards, promo codes, subscriptions, tips, split payments, deposits, or installments.
- Product reviews and ratings.
- SMS and push notifications.
- Customer edits, substitutions, partial cancellations, or partial refunds after payment.
- An advanced custom-order builder. Large/custom orders will use a contact/manual-quote path.
- One-click reorder.
- Automated Interac reconciliation without an approved business-bank/provider integration.
- A drag-and-drop page builder or unrestricted HTML editor.
- Multiple languages, unless the selected province/market makes French a launch requirement.
- Advanced workload/capacity forecasting. The MVP uses an order-count cap plus a large-order threshold.

---

## 5. Stakeholders, personas, and roles

### 5.1 Stakeholders

| Stakeholder | Interest/responsibility |
| --- | --- |
| Business owner | Final authority on menu, capacity, schedules, delivery, payment operations, policies, and launch approval |
| Customers | Browse, order, pay, track, and cancel when eligible |
| Engineering owner | Architecture, implementation, security, testing, deployment, and operations |
| Accountant/tax adviser | Approves registration position and SKU/package/delivery tax treatment |
| Local food/public-health authority | Determines permits, kitchen, handling, and inspection requirements |
| Payment providers/business bank | Apple Pay/card processing and e-transfer capabilities |
| Email provider | Transactional message delivery |

### 5.2 Customer personas

#### Persona C1 — Guest event customer

Orders for a birthday, office event, family event, or other future occasion. Wants prices, allergens, availability, delivery, and payment clarity without creating an account.

#### Persona C2 — Returning customer

Prefers to sign in, view active and historical orders, reuse verified contact information, and access tracking quickly.

#### Persona C3 — E-transfer customer

Needs an exact total, recipient/request information, unique order reference, payment deadline, and a clear explanation that the date is not confirmed until payment is verified.

#### Persona C4 — Mobile customer

Completes most or all of the journey on a phone. Needs accessible quantity controls, date selection, address entry, wallet payment, and recovery from interrupted navigation.

### 5.3 Administrative personas

#### Persona A1 — Owner/admin

Has full operational authority. Manages orders, payments, refunds, menu, availability, content, policy publication, tax configuration, and staff access. MFA is required.

#### Persona A2 — Operations staff — post-MVP unless approved

May view and fulfill orders but cannot change staff access, payment settings, tax configuration, or other owner-only controls.

---

## 6. Glossary and canonical language

| Term | Definition |
| --- | --- |
| Placed at | Timestamp when checkout created the pending order |
| Fulfillment date | Business-local calendar date for delivery |
| Fulfillment window | Exact delivery time range on the fulfillment date |
| Checkout hold | Temporary reservation of one capacity place while payment is attempted |
| Confirmed order | Payment has been verified and capacity has been committed |
| Successful order | Synonym for a paid, confirmed order; never merely a submitted checkout |
| Capacity | Maximum number of commitments accepted for a fulfillment date |
| Blackout | Owner-created full-day or partial-window closure |
| Payment status | Financial lifecycle independent of production/delivery |
| Order status | Commercial lifecycle such as pending, confirmed, cancelled, or completed |
| Fulfillment status | Production/delivery lifecycle such as received, preparing, ready, or delivered |
| Cancellation | Decision that an order will no longer be fulfilled |
| Refund | Separate process for returning money; cancellation does not mean refund completed |
| Business timezone | One configured IANA timezone used for every business cutoff and schedule rule |
| Order number | Human-readable reference for support and e-transfer reconciliation; not an access credential |

Customer-facing copy should use **fulfillment date** or **delivery date**, not “order date,” for the date on which pastries are needed.

---

## 7. Confirmed rules and decision register

### 7.1 Status definitions

- **Confirmed:** explicitly requested by the business/project owner.
- **Proposed:** recommended default that may be used for design but requires owner approval before implementation is finalized.
- **TBD — launch blocker:** no production launch until an answer is recorded.
- **Configurable:** stored as managed business data, not duplicated as hard-coded UI behaviour.

### 7.2 Confirmed rules

| ID | Confirmed rule |
| --- | --- |
| BR-001 | Customers may check out without creating an account; sign-in is optional. |
| BR-002 | Earliest fulfillment date is business-local today plus four calendar days. April 19 makes April 23 the earliest candidate. |
| BR-003 | Every Wednesday and Sunday is closed. |
| BR-004 | December 25 is closed every year. |
| BR-005 | Tuesday and Saturday evening fulfillment is closed. Exact evening hours remain TBD. |
| BR-006 | Admin may create full-day and partial-day/time blackouts. |
| BR-007 | No more than four successful orders may be accepted for one fulfillment date. |
| BR-008 | Default minimum order for an applicable menu item is four pieces; one item will have a different minimum. Exact scope remains TBD. |
| BR-009 | Customers may cancel only when strictly more than 72 hours remain before fulfillment. |
| BR-010 | Delivery requires a customer-provided serviceable address. |
| BR-011 | Apple Pay and Interac e-transfer are required payment choices. |
| BR-012 | Customers can track payment and fulfillment progress. |
| BR-013 | Admin can manage orders, menu items, item availability, website information, blackouts, statuses, and new products. |
| BR-014 | Transactional emails are sent for payment confirmation and configured order stages. |

### 7.3 Decision register

| ID | Decision | Proposed default | Status | Owner | Impact if unresolved |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | Province and city | None; obtain exact operating and delivery location | TBD — launch blocker | Business owner | Timezone, tax, permits, privacy, language, accessibility, and delivery rules cannot be finalized |
| DEC-002 | Business timezone | IANA zone derived from DEC-001 | TBD — launch blocker | Business owner | Date, blackout, email timestamp, and cancellation calculations remain ambiguous |
| DEC-003 | Fulfillment windows | Morning 09:00–12:00; Afternoon 12:00–16:00; Evening 16:00–20:00 | Proposed | Business owner | Date picker and exact 72-hour cutoff cannot be completed |
| DEC-004 | Tuesday/Saturday evening boundary | Evening window begins at 16:00 | Proposed | Business owner | Weekly schedule remains ambiguous |
| DEC-005 | Booking horizon | 90 calendar days, inclusive, configurable | Proposed | Business owner | Calendar range and future capacity generation remain undefined |
| DEC-006 | Service model | Delivery only in MVP | Proposed | Business owner | Pickup workflow and capacity sharing may expand scope |
| DEC-007 | Delivery area | Configured Canadian postal-code zones | TBD — launch blocker | Business owner | Address eligibility cannot be implemented or tested |
| DEC-008 | Delivery fee | One configurable flat fee per zone; no hidden mandatory fee | Proposed; amounts TBD | Business owner | Checkout totals and tax treatment remain incomplete |
| DEC-009 | Quantity minimum scope | Minimum and step per purchasable product/variant; default minimum 4 and step 1 | Proposed | Business owner | Cart validation and menu modelling remain ambiguous |
| DEC-010 | Mixed flavours | Model approved mixed boxes as their own menu item | Proposed | Business owner | It is unclear whether four mixed flavours satisfy one minimum |
| DEC-011 | Exceptional item | Minimum quantity configurable, expected to be 1 | TBD — launch blocker after menu arrives | Business owner | Cannot complete catalogue rules |
| DEC-012 | Large-order threshold | Above a configurable total-piece or order-value threshold, show manual quote/contact flow | Proposed; number TBD | Business owner | A single very large order could overwhelm a date while counting as only one order |
| DEC-013 | Daily capacity scope | Four commitments across website and admin/manual orders, all windows combined | Proposed | Business owner | Capacity may be bypassed through another channel |
| DEC-014 | Admin capacity override | Owner-only, mandatory reason, never silently displace existing orders | Proposed | Business owner | Exception handling and audit behaviour remain undefined |
| DEC-015 | Apple Pay/card checkout hold | 30 minutes, configurable | Proposed | Business owner/engineering | Abandoned checkout behaviour remains undefined |
| DEC-016 | E-transfer payment hold | 12 hours, configurable, but never beyond an operational cutoff defined by the owner | Proposed | Business owner | Pending transfers may monopolize capacity or expire unfairly |
| DEC-017 | Late e-transfer | Manual review; reclaim capacity if still available, otherwise reschedule with consent or refund | Proposed | Business owner | Late money could produce overbooking or disputes |
| DEC-018 | Card fallback | Offer ordinary cards through the Apple Pay processor when Apple Pay is unavailable | Proposed | Business owner | Non-Apple customers otherwise have only e-transfer |
| DEC-019 | Refund method | Apple Pay/card to original method through provider; e-transfer by separately recorded outgoing transfer | Proposed | Business owner | Cancellation screens and financial workflow remain incomplete |
| DEC-020 | Refundable charges | Product total, delivery fee, and processor-fee treatment TBD | TBD — launch blocker | Business owner/adviser | Customer policy and refund amount cannot be calculated |
| DEC-021 | Tax treatment | Accountant-approved matrix by SKU, package configuration, quantity, destination, and effective date | TBD — launch blocker | Accountant/business owner | Customer total and records may be legally incorrect |
| DEC-022 | Guest tracking | High-entropy secure email link; confirmation step before cancellation | Proposed | Business owner/engineering | Guest privacy and account recovery flow remain undefined |
| DEC-023 | Customer authentication | Passwordless email link/OTP; account optional | Proposed | Business owner/engineering | Account screens and support flow may change |
| DEC-024 | Admin roles | One owner/admin at launch; operations role later | Proposed | Business owner | Permission model may be larger than MVP |
| DEC-025 | Content management | Structured fields for announcement, homepage, About, contact, service area, hours, social links, FAQs, delivery guidance, and versioned policies | Proposed | Business owner | Admin portal scope remains ambiguous |
| DEC-026 | Language/currency | English and CAD; French requirement determined from DEC-001 | Proposed | Business owner | Content and formatting scope may change materially |
| DEC-027 | Paid-order modifications | No customer edits or partial cancellation after payment in MVP | Proposed | Business owner | Adjustment, repricing, and extra-payment workflows would be required |
| DEC-028 | Unavailable-item display | Keep published item visible with “Unavailable,” unless owner archives/hides it | Proposed | Business owner | Storefront behaviour remains inconsistent |

---

## 8. Product scope and primary journeys

### 8.1 Customer sitemap

- Home.
- Menu and category views.
- Product detail.
- Cart.
- Delivery and fulfillment selection.
- Checkout and payment-method selection.
- Payment pending/processing.
- Order confirmation.
- Secure order tracking.
- Optional sign-in/account/order history.
- Cancellation/refund status.
- About, contact, FAQ, service area, allergen information, delivery policy, cancellation/refund policy, privacy, and terms.

### 8.2 Admin sitemap

- Sign-in and MFA.
- Dashboard/action-required queue.
- Orders and order detail.
- Fulfillment calendar/production view.
- Payments, reconciliation, and refunds.
- Menu categories, products, variants, images, and availability.
- Weekly schedule, blackouts, and capacity.
- Delivery zones and fees.
- Website content and policy versions.
- Business settings.
- Reports/exports.
- Audit history.
- Staff access — post-MVP unless approved.

### 8.3 Journey J1 — Guest checkout with Apple Pay/card

1. Customer browses the published menu.
2. Customer selects required options and valid quantities.
3. Customer reviews the cart.
4. Customer provides contact and delivery information.
5. System validates the delivery zone and calculates the fee.
6. Customer selects an eligible fulfillment date/window.
7. System displays items, subtotal, tax, delivery, final total, cancellation cutoff, and accepted policies.
8. Server revalidates everything and creates a temporary capacity hold.
9. Customer authorizes payment.
10. Verified provider confirmation marks payment paid and order confirmed.
11. Customer sees confirmation/tracking and receives email.

### 8.4 Journey J2 — Guest checkout with e-transfer

1. Customer completes the same menu, cart, address, schedule, and review steps.
2. System creates a pending-payment order and longer capacity hold.
3. Customer receives exact amount, recipient/request instructions, unique order reference, and deadline.
4. Customer sends or approves the transfer.
5. Order remains **Awaiting payment** until an authoritative provider status or admin bank reconciliation verifies it.
6. Once verified, the order becomes confirmed and the customer/admin are notified.
7. If the hold expires first, the date is no longer guaranteed and late-payment policy applies.

### 8.5 Journey J3 — Track and cancel

1. Guest uses the secure emailed link; signed-in customer opens order history.
2. Customer sees payment and fulfillment as separate states.
3. Customer sees fulfillment details and exact cancellation cutoff.
4. When eligible, customer reviews refund implications and confirms cancellation.
5. System cancels once, releases capacity, starts/records the correct refund process, and notifies the customer.

### 8.6 Journey J4 — Owner fulfills an order

1. Owner receives a new confirmed-order notification.
2. Owner sees it in the relevant fulfillment date and production summary.
3. Owner changes fulfillment from Received to Preparing, Ready, Out for delivery, and Delivered.
4. Each valid change adds timeline/audit records and queues the correct customer email.
5. Repeating an action does not duplicate a state event or email.

### 8.7 Journey J5 — Availability changes during checkout

1. Customer has selected a valid date.
2. Another customer takes the final capacity place, the product becomes unavailable, the price changes, or admin adds a blackout.
3. Final server validation stops checkout before payment.
4. Customer sees the exact customer-actionable change and returns to the relevant step.
5. No stale client value is used to charge or confirm the order.

---

## 9. Functional requirements

Priority definitions: **P0** is required for safe production launch; **P1** should launch if time permits but may follow without compromising core integrity; **P2** is post-MVP.

### 9.1 Catalogue

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| CAT-001 | P0 | Anyone can browse published categories and products without signing in. Each purchasable item shows name, image, description, price/from-price, minimum quantity, and availability. Archived/unpublished items do not appear. |
| CAT-002 | P0 | Product detail shows required variants/options, ingredients, priority allergens/cross-contact wording supplied by the owner, minimum, quantity step, price, and customer instructions. Required choices must be completed before adding to cart. |
| CAT-003 | P0 | Available, temporarily unavailable, and archived are distinct. Unavailable items cannot be purchased. Archived items disappear from new orders but remain intact in order history. |
| CAT-004 | P0 | If an item becomes unavailable while in a cart, checkout identifies the item and blocks payment until it is removed or replaced. Restoring availability makes it purchasable without recreating it. |
| CAT-005 | P1 | Categories and products support owner-defined display order and accessible image alternative text. Empty categories are hidden unless intentionally published with an empty-state message. |

### 9.2 Cart and quantity

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| CART-001 | P0 | Customer can add, increase, decrease, and remove lines. Cart shows selected options, quantity, unit price, line subtotal, and provisional subtotal. Empty cart links back to the menu. |
| CART-002 | P0 | Each purchasable item/variant enforces configured minimum, step, and optional maximum in the UI and again on the server. Default minimum is 4 only after DEC-009 is approved; the exceptional item uses its own value. Errors state the actual rule. |
| CART-003 | P0 | Server recalculates current prices and validates current options at checkout. If price/fee/tax changes, customer sees and accepts the revised total before payment. No customer is charged an unreviewed amount. |
| CART-004 | P1 | Cart persists across normal navigation and refresh for a documented lifetime. Authentication failure does not erase it. Product or configuration changes may invalidate individual lines but must not silently substitute them. |
| CART-005 | P0 | When large-order threshold is exceeded, online payment is blocked and customer is directed to the manual quote/contact path; no capacity is committed until the owner approves and creates the order. |

### 9.3 Fulfillment availability and capacity

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| AVL-001 | P0 | Every availability and cutoff calculation uses the configured business IANA timezone, independent of customer device timezone. |
| AVL-002 | P0 | Earliest candidate is business-local today plus four calendar days. On April 19, April 19–22 are rejected and April 23 is the first candidate. If April 23 is otherwise closed/full, it remains unavailable. |
| AVL-003 | P0 | Every Wednesday, every Sunday, and December 25 annually are fully closed. Tuesday/Saturday evening windows are closed while their allowed daytime windows remain eligible. |
| AVL-004 | P0 | Customer cannot select beyond the configurable inclusive booking horizon. The UI distinguishes “not open yet” from “sold out.” |
| AVL-005 | P0 | Full-day blackouts close all windows. Partial blackouts close overlapping windows only. Confidential internal blackout notes are never public. |
| AVL-006 | P0 | A date with four confirmed orders is full. Active, unexpired holds temporarily consume capacity. Expired/failed/released holds and eligible cancellations release it. |
| AVL-007 | P0 | Capacity covers website and approved manual/admin orders. With one remaining place and five concurrent attempts, no more than one new active hold/confirmation succeeds. |
| AVL-008 | P0 | Calendar is informational. Server/database revalidates immediately before payment and when payment is confirmed. Manually changing a request/URL cannot bypass a closure or capacity rule. |
| AVL-009 | P0 | Customer-friendly reasons distinguish insufficient notice, weekly closure, annual closure, blackout, unavailable window, sold out, unsupported delivery, and beyond horizon. |
| AVL-010 | P0 | Adding a blackout or reducing capacity never silently cancels existing confirmed orders. Admin sees affected orders and must resolve them operationally. |
| AVL-011 | P1 | Customer can view available windows for a date before completing payment; selected date/window appear consistently in review, confirmation, tracking, and emails. |

### 9.4 Delivery

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| DEL-001 | P0 | Collect recipient name, email, phone, address line 1, city, province, and postal code. Unit/address line 2 and plain-text delivery instructions are optional. Required fields have accessible field-level errors. |
| DEL-002 | P0 | Server validates Canadian postal-code format and configured service zone. Out-of-area address cannot proceed to payment and receives a clear explanation. |
| DEL-003 | P0 | Delivery fee is computed from configured rules and displayed separately before payment. Changing address recalculates eligibility, fee, tax, and total. |
| DEL-004 | P0 | Confirmed order stores an immutable delivery snapshot. Later account/address changes do not alter it. Only authorized customer/staff access can view it. |
| DEL-005 | P0 | Checkout and policy explain delivery-window expectations, customer availability, incorrect-address handling, failed delivery, redelivery, and contact process after the owner approves those rules. |

### 9.5 Guest and authenticated access

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| ID-001 | P0 | Guest can browse, order, pay, receive confirmation, track, and cancel when eligible without creating an account. Marketing consent is optional and separate. |
| ID-002 | P0 | Guest order access requires a high-entropy secure link or verified email challenge. Order number alone never reveals existence, customer, address, payment, or tracking details. |
| ID-003 | P1 | Customer may create/sign into an optional passwordless account and view only their orders. Customer A cannot access Customer B by changing identifiers. |
| ID-004 | P2 | A verified account may claim historical guest orders only after proving ownership of the matching email. Typing an email alone is insufficient. |
| ID-005 | P0 | Admin uses a separate protected route/permission model with MFA. Customer authentication never grants admin capabilities. |

### 9.6 Checkout

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| CHK-001 | P0 | Review shows every item/option, quantity, unit/line amount, fulfillment date/window, address, subtotal, delivery fee, tax lines, final CAD total, exact cancellation cutoff, and policy links. |
| CHK-002 | P0 | Server independently revalidates current products, options, quantities, prices, date/window, capacity, delivery, fee, tax, total, and policy requirements before initiating payment. |
| CHK-003 | P0 | At payment step, system creates one explicit-expiry capacity hold. Apple Pay/card and e-transfer may use different configurable durations. Customer sees relevant payment deadline. |
| CHK-004 | P0 | Repeated clicks, refreshes, network retries, and duplicate provider callbacks cannot create duplicate orders, charges, capacity commitments, refunds, timeline events, or emails. |
| CHK-005 | P0 | Required terms/cancellation/refund acknowledgement stores accepted policy version and timestamp. Customer can review policy before paying. |
| CHK-006 | P0 | Verified payment shows confirmation. Unverified e-transfer shows “Awaiting payment.” Uncertain provider state shows “Processing” and can recover by secure refresh; it never claims payment failed or succeeded without evidence. |

### 9.7 Payments

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| PAY-001 | P0 | Checkout offers Apple Pay and Interac e-transfer in CAD. Apple Pay appears only on eligible environments. Ordinary card fallback is included only after DEC-018 approval. |
| PAY-002 | P0 | Apple Pay/card payment is confirmed only by a signature-verified authoritative provider event. Browser redirect or closed/open browser does not determine payment state. Amount, CAD currency, and internal reference must match. |
| PAY-003 | P0 | Each e-transfer order displays exact amount, approved recipient/request flow, unique order/payment reference, deadline, and warning that missing reference may delay confirmation. Screenshot or “I paid” action is not proof. |
| PAY-004 | P0 | Manual e-transfer reconciliation records bank reference, received amount/time, actor, and comparison with expected order. A bank reference cannot be used twice. Automated integration, if approved later, enters the same payment-event model. |
| PAY-005 | P0 | Missing reference, wrong amount, duplicate transfer, payment after expiry/cancellation, or payment when date is full enters an exception state; it cannot silently confirm. |
| PAY-006 | P0 | Failed/abandoned Apple Pay/card releases its hold when retry/expiry policy ends. Expired unpaid e-transfer no longer guarantees the date. Customer can see whether retry is still possible. |
| PAY-007 | P0 | Late e-transfer enters “Payment received — review required.” Owner may claim current capacity, reschedule with customer consent, or refund according to approved policy. |
| PAY-008 | P0 | A paid order cannot start an ordinary second payment. Any apparent overpayment/double payment is flagged without consuming extra capacity. |
| PAY-009 | P0 | Refund has its own lifecycle. Card refund completes only after provider confirmation. E-transfer refund completes only after owner records return reference/evidence. Cancellation alone never displays “Refunded.” |
| PAY-010 | P0 | Application stores provider references/tokens only and never stores full card number, card security code, Apple Pay credential, bank password, or online-banking login. |

### 9.8 Order confirmation, tracking, and cancellation

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| ORD-001 | P0 | Every order has an internal identifier and separate readable order number. Secure confirmation shows order number, paid/pending total, fulfillment date/window, delivery summary, payment state, and tracking access. |
| ORD-002 | P0 | Payment, order, and fulfillment states are shown separately. “Order received” is displayed only after verified payment and confirmation; pending e-transfer says “Awaiting payment.” |
| ORD-003 | P0 | Customer-visible timeline shows approved status events and business-timezone timestamps. It excludes internal notes, audit data, and provider payloads. Duplicate actions cannot duplicate events. |
| ORD-004 | P0 | Customer cancellation is eligible only when current time is strictly earlier than fulfillment-window start minus 72 hours. At exactly 72 hours it is denied. The exact cutoff is displayed. |
| ORD-005 | P0 | Eligible full cancellation occurs once, releases capacity once, records timeline/audit, initiates the method-appropriate refund state, and sends confirmation. Completed/delivered/already-cancelled orders cannot be customer-cancelled. |
| ORD-006 | P0 | Unpaid pending order may be cancelled/expired independently of the paid-order 72-hour policy. A transfer received afterward enters late-payment exception handling. |
| ORD-007 | P0 | Paid-order edits, substitutions, partial cancellations, and partial refunds are not self-service in MVP. Customer is directed to contact the business. |
| ORD-008 | P1 | Signed-in customer order history supports current and historical orders without exposing another customer’s data. |

### 9.9 Transactional notifications

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| NOT-001 | P0 | Email events cover awaiting e-transfer, verified payment/order confirmation, payment expiry/action required, Preparing, Ready, Out for delivery, Delivered, Cancelled, Refund pending/completed/failed, and relevant late-payment resolution. |
| NOT-002 | P0 | Status/payment transaction commits independently of email. Provider outage cannot undo paid order; email remains queued and retries. |
| NOT-003 | P0 | Same order/event/template version is deduplicated. Replayed webhook or repeated status action cannot send the same business email twice. |
| NOT-004 | P0 | Owner can see queued, sent, failed, provider message reference, attempts, and timestamps; exhausted failures appear in Action required. |
| NOT-005 | P1 | Owner may resend a failed/requested message. Resend creates a new audited attempt without changing order state. |
| NOT-006 | P0 | Transactional email is independent of marketing consent. Marketing content/consent, if later added, is separate. |

### 9.10 Admin portal

| ID | Priority | Requirement and acceptance criteria |
| --- | --- | --- |
| ADM-001 | P0 | Only active authorized staff can access admin routes/data/actions. MFA and documented account recovery are enabled before production. |
| ADM-002 | P0 | Dashboard shows today/upcoming confirmed orders, pending payments, active holds, action-required exceptions, capacity used/remaining, and fulfillment totals. Counts match source records. |
| ADM-003 | P0 | Order list searches order number, customer name/email/phone and filters by fulfillment range, order, payment, fulfillment, and payment method. |
| ADM-004 | P0 | Order detail shows immutable items/prices/tax/fees, address/instructions, window, customer, payments/refunds, timeline, notification history, and audit history appropriate to role. |
| ADM-005 | P0 | Only valid fulfillment transitions are offered. One transition updates current state, appends timeline/audit, and queues email atomically. Owner override requires reason. |
| ADM-006 | P0 | Paid quantities, prices, tax, and total cannot be silently edited. MVP uses cancellation/replacement or a documented owner-only adjustment process. |
| ADM-007 | P0 | Manual e-transfer reconciliation requires bank reference, amount, received time, and actor. System flags mismatch, duplicate, missing reference, late payment, and full-date conflicts. |
| ADM-008 | P0 | Refund view separates requested, processing, completed, and failed. Payment/refund evidence cannot be deleted through admin. |
| ADM-009 | P0 | Owner can create/edit categories, products, variants, options, images, prices, minimum/step/maximum, ingredients, allergens, tax classification, instructions, display order, and publication state. |
| ADM-010 | P0 | Owner can configure weekly windows, recurring closures, full/partial blackouts, default/date-specific capacity, hold durations, booking horizon, lead time, timezone, and cancellation cutoff. High-impact changes require confirmation/audit. |
| ADM-011 | P0 | Blackout/capacity changes list affected confirmed orders and never silently cancel/move them. Capacity cannot be reduced below commitments without prominent owner confirmation and resolution warning. |
| ADM-012 | P0 | Owner can edit structured announcement, homepage sections, About, contact, service area, business hours, social links, FAQs, and delivery guidance without deployment. Preview/validation precede publication. |
| ADM-013 | P0 | Refund, cancellation, privacy, and terms content is versioned with draft/published state and effective date. Each order retains accepted versions. |
| ADM-014 | P0 | Append-only audit covers status, reconciliation, refund, cancellation, capacity override, blackout, price, tax, policy publication, content, and access changes with actor/time/reason/safe before-after values. |
| ADM-015 | P1 | Production report aggregates required quantities by fulfillment date/window/product/variant and excludes cancelled/expired orders. |
| ADM-016 | P1 | Financial summary shows order count, gross sales, tax, delivery fees, refunds, net collected, payment methods, and cancellation count for business-timezone date range. |
| ADM-017 | P1 | CSV export follows current filters, includes generated time/timezone, is staff-only, and neutralizes spreadsheet-formula injection. |
| ADM-018 | P1 | Owner can create a phone/manual order, but it passes the same catalogue, delivery, tax, availability, and capacity rules. Override requires owner reason. |

---

## 10. Canonical business rules

### 10.1 Availability evaluation order

For every requested date/window, the authoritative service evaluates:

1. Store-wide emergency ordering enabled/disabled state.
2. Business-local current date and configured booking horizon.
3. Four-calendar-day lead time.
4. Annual and weekly closures.
5. Admin full-day and partial-window blackouts.
6. Product-specific availability or additional lead time, if configured.
7. Delivery-zone/window compatibility, if applicable.
8. Large-order/manual-quote threshold.
9. Active capacity holds and confirmed commitments.

A date/window is offered only if every applicable rule passes. Closing a date to new orders does not alter already confirmed orders.

### 10.2 Lead-time rule

- All calculations use business-local calendar date.
- Earliest candidate equals local today plus four calendar days.
- This is not a literal 96-hour calculation.
- The candidate must still pass all closures, blackouts, horizon, delivery, product, and capacity rules.

### 10.3 Quantity rule

- Each purchasable item/variant has minimum quantity, quantity step, and optional maximum.
- Proposed default is minimum 4 and step 1.
- Exceptional item overrides the default.
- Mixed boxes should be explicit products unless DEC-010 is changed.
- Cart feedback is helpful, but final server validation is authoritative.
- Tax classification may depend on product, packaging, and count; quantity validation and tax calculation must not be designed independently.

### 10.4 Capacity and holds

The invariant is:

**Active, unexpired checkout holds + confirmed orders must not exceed configured capacity for the fulfillment date.**

At final checkout the system must, as one protected operation:

1. Lock/evaluate the relevant service date.
2. Expire stale holds.
3. Revalidate the entire order.
4. Claim one capacity place if available.
5. Create one idempotent pending order/payment attempt.

Provider calls happen after the short database transaction. Verified payment converts that exact hold to a confirmed commitment. Failed/expired payment releases it. Eligible cancellation releases confirmed capacity even if refund is still pending.

If payment is received after expiry, capacity is acquired again only if currently available. Otherwise the order enters manual resolution; it does not become the fifth confirmed order.

### 10.5 Cancellation rule

- Fulfillment window must have an exact start timestamp.
- Customer cancellation is allowed only when `now` is strictly earlier than 72 hours before that start.
- 72 hours plus one second is eligible; exactly 72 hours and 72 hours minus one second are not.
- Unpaid-order cancellation/expiry is separate from paid-order cancellation.
- Owner may cancel at any time with a required reason.
- Cancellation and refund are separate states.
- Full customer cancellation only is in MVP.

### 10.6 Product/cart changes before payment

If product availability, option, minimum, price, delivery fee, tax, date, window, or capacity changes before authorization:

- Stop payment initiation.
- Explain the affected line/rule in plain language.
- Recalculate the authoritative order.
- Require customer review before a new payment attempt.
- Never silently substitute a product, option, date, or price.

---

## 11. State models and transitions

### 11.1 Payment states

| State | Meaning | Permitted next states |
| --- | --- | --- |
| Pending | Payment method selected/order awaiting funds | Processing, Paid, Failed, Expired, Cancelled |
| Processing | Provider/bank result not yet final | Paid, Failed, Review required |
| Review required | Late, unmatched, wrong amount, duplicate, or uncertain payment | Paid, Refund pending, Rescheduled, Closed unresolved |
| Paid | Verified money received | Refund pending, Partially refunded later if feature added |
| Failed | Authoritative attempt failed | Pending through a new allowed attempt, or Expired |
| Expired | Deadline/hold ended unpaid | Closed; late payment goes to Review required |
| Refund pending | Return initiated but not verified complete | Refunded, Refund failed |
| Refunded | Verified refund completed | Terminal for that payment/refund amount |
| Refund failed | Return failed or needs intervention | Refund pending after an audited retry |

### 11.2 Order states

| State | Meaning | Permitted next states |
| --- | --- | --- |
| Pending payment | Order exists but payment is not verified | Confirmed, Expired, Cancelled, Review required |
| Review required | Owner must resolve payment/capacity exception | Confirmed, Rescheduled, Cancelled |
| Confirmed | Paid and capacity committed | Completed, Cancelled |
| Cancelled | Will not be fulfilled | Terminal; refund continues separately |
| Completed | Fulfillment finished | Terminal |

### 11.3 Fulfillment states

| Internal state | Customer wording | Trigger/meaning |
| --- | --- | --- |
| Received | Order received | Payment verified and order confirmed |
| Preparing | Being made | Owner has started preparation |
| Ready | Ready | Production completed and awaiting dispatch |
| Out for delivery | Out for delivery | Order dispatched |
| Delivered | Delivered | Delivery completed |

Normal fulfillment moves forward one state at a time. Owner override/rollback requires a reason and audit record. Payment state must not be overwritten by a fulfillment update.

---

## 12. Notification matrix

| Event | Customer email | Admin alert | Deduplication key concept |
| --- | --- | --- | --- |
| E-transfer order created | Instructions, exact amount/reference/deadline | Optional pending-payment notice | Order + payment attempt + instructions version |
| Payment verified/order confirmed | Receipt and fulfillment summary | New confirmed order | Order + payment-confirmed event |
| Payment expired/failed | Retry/recreate guidance | Only when action is required | Payment attempt + terminal event |
| Late/unmatched/wrong e-transfer | Review-required guidance | Action required | Payment event/reference + exception type |
| Preparing | Status update | No | Order + Preparing event |
| Ready | Status update | No | Order + Ready event |
| Out for delivery | Status update and delivery reminder | No | Order + Out-for-delivery event |
| Delivered | Completion | No | Order + Delivered event |
| Cancelled | Cancellation and refund expectation | When owner/customer action needs follow-up | Order + cancellation event |
| Refund initiated | Refund pending | No | Refund + initiated event |
| Refund completed | Amount/method confirmation | No | Refund + completed event |
| Refund failed | Customer-appropriate delay notice if needed | Action required | Refund + failure event |

The database is the source of truth. Email delivery is informational and must not control whether payment/order processing commits.

---

## 13. Conceptual data requirements

This is a product-level model, not an implementation schema.

| Domain | Required records/invariants |
| --- | --- |
| Identity | Customer profile where applicable; protected staff membership/role; orders may belong to guest or authenticated customer |
| Catalogue | Categories, items, variants/options, images, price, quantity rule, tax classification, publication/availability/archive state |
| Availability | Business timezone/settings, weekly windows, recurring closures, blackout ranges, date-specific capacity, checkout holds |
| Commerce | Cart, pending/confirmed order, immutable order lines, delivery snapshot, totals/tax lines, accepted policy versions |
| Payments | Payment attempt, provider event, e-transfer reconciliation, external references, refund records; unique idempotency/provider-event constraints |
| Operations | Current order/fulfillment state, append-only customer timeline, notification outbox/history, append-only audit log |
| Content | Structured site content, FAQ, business/contact information, versioned policies |

Data rules:

- Monetary amounts are stored as integer CAD cents with explicit currency.
- Created/updated/event timestamps are absolute timestamps; business decisions use the configured IANA timezone.
- Fulfillment retains a business-local date and exact window boundaries.
- Order lines, address, totals, tax, and policy versions are immutable snapshots after submission/confirmation as applicable.
- Products referenced by orders are archived, not deleted.
- Order number is separate from internal identifier and secure access credential.
- Provider event/reference and idempotency values are unique where required.
- Common customer/date/status/provider/outbox access paths require indexes.

### 13.1 Permission matrix

| Data/action | Public visitor | Secure guest | Signed-in customer | Owner/admin | Trusted backend |
| --- | --- | --- | --- | --- | --- |
| Published catalogue | Read | Read | Read | Manage | Manage |
| Availability summary | Read | Read | Read | Manage rules | Calculate/manage |
| Create hold/order | Only through validated server operation | Same | Same | Same/manual flow | Authorized transaction |
| Read an order | No | Their token-verified order only | Their linked orders only | All operational orders | As required |
| Change fulfillment status | No | No | No | Valid transitions | Worker operations only |
| Read/write payments/refunds | No | Limited customer-facing status | Limited own status | Operational views/actions | Provider/reconciliation operations |
| Audit/outbox/provider events | No | No | No | Appropriate read only | Append/process |
| Menu/content/settings | Published read only | Published read only | Published read only | Manage by role | As required |

Every exposed Supabase table must use default-deny Row Level Security plus explicit grants. Public clients do not directly write orders, capacity, payments, refunds, statuses, audit, or notification jobs. Privileged secrets remain server-side.

---

## 14. Non-functional requirements

### 14.1 Security

| ID | Requirement |
| --- | --- |
| NFR-SEC-001 | RLS and explicit database grants enforce public, customer, and staff boundaries. Automated negative tests cover anonymous, customer A, customer B, inactive staff, and owner. |
| NFR-SEC-002 | Service-role, payment, email, and bank secrets never appear in browser bundles, public environment variables, URLs, repository history, or customer-visible logs. |
| NFR-SEC-003 | Server/database revalidate all browser-supplied prices, quantities, products, dates, capacity, delivery, tax, and cancellation requests. |
| NFR-SEC-004 | Payment callbacks validate authenticity/signature, amount, currency, reference, permitted transition, and unique event identity. |
| NFR-SEC-005 | Guest tracking uses at least 128 bits of effective entropy, stores only a safe verifier/hash where appropriate, and supports expiry/revocation. |
| NFR-SEC-006 | Sign-in, tracking lookup, checkout/hold creation, payment retry, and resend operations are rate-limited and monitored. |
| NFR-SEC-007 | Production uses HTTPS and secure session/cookie controls. Admin MFA and account-recovery procedure are verified before launch. |
| NFR-SEC-008 | No unresolved critical/high security finding may launch; any accepted lower finding has owner, justification, and remediation date. |

### 14.2 Privacy and data governance

| ID | Requirement |
| --- | --- |
| NFR-PRV-001 | Every collected personal field has a documented operational/legal purpose; optional information remains optional. |
| NFR-PRV-002 | Before launch, approve retention periods for accounts, order contacts, addresses/instructions, financial evidence, audit, analytics, and support data. |
| NFR-PRV-003 | Support verified access/correction and permitted deletion/anonymization requests without corrupting legally required financial/audit records. |
| NFR-PRV-004 | Transactional communication and optional marketing consent remain separate. |
| NFR-PRV-005 | Logs/analytics exclude full addresses, credentials, payment details, tokens, and unnecessary contact information; sensitive values are redacted. |
| NFR-PRV-006 | Record production region, subprocessors, data flow, and cross-border processing before launch. |

### 14.3 Accessibility and responsive usability

| ID | Requirement |
| --- | --- |
| NFR-A11Y-001 | Target WCAG 2.2 AA for customer and admin core journeys, subject to any stricter applicable provincial requirement. |
| NFR-A11Y-002 | Menu, cart, quantity controls, date/window picker, checkout, tracking, cancellation, and admin order updates work by keyboard and expose correct assistive-technology semantics. |
| NFR-A11Y-003 | Errors identify the affected field/item, explain correction in text, use predictable focus/announcement, and never rely on colour alone. |
| NFR-A11Y-004 | Text/controls meet contrast requirements, remain usable at 200% zoom, and retain core functionality from 320 CSS pixels upward. |

### 14.4 Performance and reliability

| ID | Requirement |
| --- | --- |
| NFR-PERF-001 | Public pages target p75 LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1 after sufficient production measurement. |
| NFR-PERF-002 | Excluding third-party provider latency, availability reads target p95 at or below 1 second and order mutations p95 at or below 2 seconds under expected launch load. |
| NFR-PERF-003 | Images use responsive sizes/optimization and owner upload validation. |
| NFR-REL-001 | Storefront/order-placement target is 99.5% monthly availability, excluding announced maintenance; final SLO depends on selected hosting plans. |
| NFR-REL-002 | Uncertain dependency state never displays a false Paid or Confirmed result. It produces a recoverable pending/error state and admin visibility. |
| NFR-REL-003 | Order creation, capacity, callbacks, reconciliation, status, refund, and email processing are idempotent/retry-safe. |
| NFR-REL-004 | Holds stop consuming capacity within five minutes of configured expiry, including after a worker restart. |
| NFR-REL-005 | All business time calculations are tested at local midnight, daylight-saving changes, leap dates, and horizon boundaries. |

### 14.5 Observability, backup, and recovery

| ID | Requirement |
| --- | --- |
| NFR-OBS-001 | Order/payment/webhook/email operations carry safe correlation IDs so one transaction can be traced without exposing PII/secrets. |
| NFR-OBS-002 | Owner/engineering alerts cover sustained checkout failure, paid-but-unconfirmed orders, unmatched/late transfers, failed refunds, stuck holds, and exhausted email jobs. |
| NFR-OBS-003 | Operational view reports checkout errors, webhook failures, payment/order mismatches, reconciliation queue, email queue age, and hold-expiry failures. |
| NFR-BKP-001 | Backup retention, Recovery Point Objective, and Recovery Time Objective are approved against the chosen Supabase/storage plans. Proposed MVP targets: RPO no worse than 24 hours and RTO no worse than 8 hours. |
| NFR-BKP-002 | Restore is tested into non-production before launch and at least twice yearly thereafter. Findings and remediation are documented. |
| NFR-BKP-003 | Migrations, policies, indexes, and deployable configuration are version controlled; production is not dependent on undocumented dashboard-only changes. |

### 14.6 Engineering and release quality

| ID | Requirement |
| --- | --- |
| NFR-QA-001 | CI must pass type checks, linting, unit tests, database/RLS tests, integration tests, migration verification, and production build before release. |
| NFR-QA-002 | Local, staging, and production use separate Supabase/payment/email configurations and secrets. Test credentials never process production payments. |
| NFR-QA-003 | A production-like staging flow verifies auth, database migrations, payment callbacks, email, capacity, cancellation, and refund changes before production deployment. |
| NFR-QA-004 | Business owner signs off on menu, prices, quantities, tax, delivery, email wording, policies, and complete customer/admin journeys before live payments. |

---

## 15. Analytics requirements

Analytics must be privacy-conscious and must not contain full address, delivery instructions, payment credentials, guest access tokens, or sensitive order contents.

Minimum events:

- Menu viewed.
- Product viewed.
- Item added/removed/quantity changed.
- Cart viewed.
- Delivery eligibility accepted/rejected with non-PII reason code.
- Fulfillment date/window accepted/rejected with reason code.
- Checkout started.
- Checkout validation failed with category/reason.
- Payment method selected.
- Payment completed, failed, abandoned, or expired.
- E-transfer entered reconciliation exception category.
- Order confirmed.
- Cancellation requested/accepted/denied with reason category.
- Refund completed/failed.
- Order delivered.

Analytics are not the financial or operational source of truth.

---

## 16. Error and exception handling

| Scenario | Required behaviour |
| --- | --- |
| Price, minimum, tax, or fee changes in cart | Recalculate, explain, and require review before payment |
| Product/variant becomes unavailable | Block checkout; never substitute silently |
| Selected date/window becomes full | Do not charge; return customer to availability selection |
| Admin blackouts a date with confirmed orders | Preserve orders; warn/list affected orders; audit change |
| Payment succeeds but browser closes | Provider callback confirms; secure tracking later shows correct result |
| Browser says success but provider does not | Remain Processing/Pending; never confirm from redirect alone |
| Duplicate/out-of-order provider callback | Deduplicate and apply only legal monotonic transition |
| Email provider fails after payment | Order remains confirmed; queue retries and alert after exhaustion |
| E-transfer missing order reference | Unmatched/action-required; do not confirm automatically |
| E-transfer underpayment/overpayment | Review required; owner follows approved discrepancy policy |
| Duplicate e-transfer reference | Reject second assignment and display existing match |
| Late e-transfer and date has capacity | Owner may accept after revalidation and audit |
| Late e-transfer and date is full | Never overbook; reschedule with consent or refund |
| Transfer arrives after cancellation | Review/refund; do not restore order automatically |
| Refund provider fails | Order remains cancelled; refund shows Failed/Action required |
| Customer retries checkout rapidly | Same attempt is idempotent and cannot claim multiple holds |
| Customer loses guest link | Verified email recovery issues a replacement without exposing other orders |
| Supabase/payment service is unavailable | Fail safely with pending/retry guidance; owner can disable checkout globally |

Customer errors use plain language plus a safe support/order reference. Technical details remain in protected logs.

---

## 17. Canadian compliance and policy requirements

This section is a release checklist, not legal or tax advice.

### 17.1 Tax

- Confirm GST/HST registration position and effective date.
- Classify every SKU, variant, package/count configuration, mixed bundle, custom item, and delivery fee with an accountant.
- Do not apply one global Canadian percentage.
- Preserve applied tax lines/rates/classification as order snapshots with effective dates.
- Support destination-based rules if delivery province affects place of supply.
- Preserve invoices, payments, refunds, and required financial records for the approved retention period.
- Specifically review CRA treatment of sweet single-serving pastries sold below six versus qualifying quantities of six or more; the minimum-four rule can change tax outcome.

### 17.2 Food, allergens, and permits

- Confirm federal, provincial, municipal, public-health, zoning, home-kitchen, inspection, and food-handler requirements.
- Maintain an owner-approved SKU sheet: recipe version, ingredients, suppliers, priority allergens, cross-contact risks, package count/weight, storage, shelf life, label requirements, and tax class.
- Display accurate ingredients/allergens before checkout where supplied.
- Do not claim allergen-free preparation unless the business can substantiate it.
- Establish applicable traceability/recall records and procedures.

### 17.3 Consumer policies and pricing

Before payment, disclose legal/business identity, contact information, items/options/counts, fulfillment date/window, address, subtotal, tax, delivery and mandatory fees, final total, payment confirmation rule, cancellation cutoff, refund method/timing, failed-delivery policy, and unavailable-item/business-cancellation handling.

- Mandatory fees must not first appear after the customer is committed.
- Approved refund/cancellation policy must not claim to remove statutory remedies.
- Each order stores the policy version accepted.

### 17.4 Privacy and communications

- Determine whether PIPEDA or a provincial private-sector privacy law applies.
- Appoint a privacy contact and document purposes, consent, subprocessors, cross-border processing, retention, access/correction, deletion, and breach response.
- Keep order/payment/status emails transactional.
- Marketing consent, if added, is separate, optional, recorded, and withdrawable.

### 17.5 Accessibility and language

- Confirm province-specific accessibility obligations and target WCAG 2.2 AA.
- If operating in or actively serving Quebec, complete dedicated QST, Law 25, French-language, distance-sales, and policy review before launch.

---

## 18. Risks and mitigations

| Risk | Probability/impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Two customers take final capacity | Medium/Critical | Transactional holds, idempotency, database concurrency tests | Engineering |
| Pending e-transfers monopolize dates | Medium/High | Explicit expiry, rate limits, one-active-attempt controls, exception queue | Product/engineering |
| Automatic Interac integration unavailable | High/Medium | Manual audited reconciliation MVP; bank discovery before automation | Business owner |
| Late/unmatched/wrong e-transfer | Medium/High | Review queue and approved refund/reschedule runbook | Business owner |
| Apple Pay unavailable on customer device | High/Medium | Approve ordinary card fallback and retain e-transfer | Business owner |
| Four orders do not represent workload | High/High | Large-order threshold now; capacity points later | Business owner |
| Incorrect pastry tax | Medium/Critical | Accountant-approved quantity/package matrix; immutable snapshots | Business owner/adviser |
| Timezone/DST cutoff error | Medium/High | One IANA zone; boundary tests; no device-time authority | Engineering |
| Admin blocks date containing orders | Medium/High | Conflict warning, affected-order list, no silent cancellation | Engineering/product |
| Duplicate/lost payment callback | Medium/Critical | Signature validation, idempotency, retries, reconciliation alerts | Engineering |
| Email outage | Medium/Medium | Durable outbox/retries; database remains source of truth | Engineering |
| Guest link leakage/guessing | Low/High | High-entropy access, expiry/revocation, sensitive-action confirmation | Engineering |
| Address outside delivery area | Medium/Medium | Server zone validation before payment | Product/engineering |
| Allergy expectation mismatch | Medium/Critical | Accurate owner-approved content and process controls | Business owner |
| Owner loses admin access | Low/High | MFA recovery and documented emergency procedure | Business owner/engineering |
| Privacy breach | Low/Critical | RLS, least privilege, retention, secret management, audit, incident plan | Engineering/business owner |

---

## 19. Test and acceptance plan

### 19.1 Required test layers

- Unit tests for lead time, schedule, quantities, totals, cancellation cutoff, and state transitions.
- Database tests for constraints, RLS, atomic capacity allocation, idempotency, and authorization denial cases.
- Integration tests for payment callbacks, reconciliation, refunds, email outbox, and expiration workers.
- End-to-end tests for guest/account ordering, both payment branches, tracking, admin updates, cancellation, and refund.
- Manual business-owner UAT for content, menu accuracy, operational workflow, email wording, mobile usability, and production readiness.
- Accessibility testing using automated tools plus keyboard and screen-reader review of core flows.

### 19.2 Mandatory boundary scenarios

1. April 19 rejects April 22 and allows April 23 when otherwise open.
2. Business-local midnight differs from customer device timezone.
3. Wednesday, Sunday, December 25, leap day, and booking-horizon boundary.
4. Tuesday/Saturday daytime accepted and evening rejected.
5. Full-day versus partial-window blackout.
6. Four confirmed orders and at least five parallel attempts for the final space.
7. Active, expired, failed, released, and late-payment holds.
8. Manual/admin order consumes the same capacity.
9. Admin blackouts a date containing confirmed orders.
10. Exactly 72 hours, 72 hours plus one second, and minus one second.
11. Daylight-saving transition around fulfillment/cancellation.
12. Quantity 3, 4, 5, configured step, exceptional item, maximum, and mixed-box rule.
13. Product, option, price, fee, or tax changes while in cart.
14. Duplicate and out-of-order payment callbacks.
15. Payment succeeds but browser closes before returning.
16. Email fails after payment succeeds.
17. Missing-reference, underpaid, overpaid, duplicate, late, and unmatched e-transfer.
18. Cancellation releases capacity before refund completion.
19. Refund fails after cancellation.
20. Customer A attempts to access Customer B’s order.
21. Order number guessed without secure token.
22. Address at edge/outside configured zone.
23. Admin repeats, skips, or rolls back fulfillment status.
24. Store/payment/database dependency becomes unavailable during checkout.

### 19.3 Definition of done for a requirement

A requirement is done only when:

- Business rules and design are approved.
- Implementation meets its acceptance criteria.
- Relevant unit/integration/end-to-end/RLS tests pass.
- Accessibility and responsive states are verified where applicable.
- Error, loading, empty, and retry states exist.
- Audit/monitoring are present for sensitive operations.
- Documentation and operational runbook are updated.
- No unresolved critical/high defect remains.

---

## 20. Release and rollout plan

### Stage 1 — Requirements approval

- Resolve every launch-blocking decision.
- Approve menu model, delivery, schedule, payment, refund, tax, policy, and compliance inputs.

### Stage 2 — Internal development and staging

- Use separate local, staging, and production services/configuration.
- Complete one vertical slice: one product → cart → valid date → test payment → admin order → status update → customer email.
- Expand only after the slice passes failure and security cases.

### Stage 3 — Business-owner UAT

- Owner tests realistic guest/card/e-transfer/manual admin scenarios.
- Use real menu data and representative delivery zones.
- Rehearse late/unmatched transfer, cancellation, refund, blackout conflict, and support runbooks.

### Stage 4 — Controlled soft launch

- Enable a limited booking horizon and/or selected fulfillment dates.
- Process low volume with active owner/engineering monitoring.
- Review every payment, capacity, email, and delivery exception daily.

### Stage 5 — General launch

- Expand booking horizon/capacity only after soft-launch review.
- Keep an owner-accessible emergency “pause new checkout” control that does not affect tracking or existing orders.

### Rollback principle

If checkout safety is uncertain, disable new order/payment initiation while preserving admin access, existing order tracking, payment reconciliation, and data. Never roll back by deleting production orders or payments.

---

## 21. Production launch gates

Production payments must remain disabled until all applicable items pass:

- [ ] Business owner approved exact province, city, timezone, windows, evening cutoff, horizon, delivery zones/fees, capacity scope, quantity rules, large-order threshold, payment deadlines, late-payment outcome, and refund rules.
- [ ] Complete products, variants/options, prices, minimums, maximums, images, ingredients, allergens, instructions, availability, and tax classes loaded and owner-approved.
- [ ] Accountant approved registration position and SKU/package/quantity/delivery tax matrix.
- [ ] Required permits, kitchen/public-health, labeling, traceability, and food-handler obligations confirmed.
- [ ] Cancellation, refund, privacy, terms, allergen, delivery, failed-delivery, and contact content published with versions.
- [ ] Payment provider account approved for production; real-device Apple Pay and card fallback decision tested.
- [ ] E-transfer bank account/process selected; reconciliation, expiry, late payment, over/underpayment, and refund runbooks rehearsed.
- [ ] Concurrent checkout test proves capacity never exceeds four.
- [ ] Payment signature, duplicate, out-of-order, timeout, browser-close, and retry tests pass.
- [ ] Cancellation boundary, timezone, daylight-saving, closures, horizon, and quantity tests pass.
- [ ] Cross-customer, guest-token, staff, and RLS authorization tests pass.
- [ ] Admin MFA and recovery procedure verified.
- [ ] Transactional email domain/authentication, wording, retry, dedupe, and failure alerts verified.
- [ ] Accessibility review of menu, cart, date picker, checkout, tracking, cancellation, and admin core flow passes agreed standard.
- [ ] Monitoring, alerts, backups, restore test, incident contacts, and emergency checkout pause are documented.
- [ ] Production smoke test and rollback/support plan completed.
- [ ] Business owner signed final UAT approval.

---

## 22. Open-question worksheet for the business owner

| ID | Question | Answer | Decision date |
| --- | --- | --- | --- |
| OQ-001 | What is the exact Canadian province and city of operation? |  |  |
| OQ-002 | What is the confirmed IANA business timezone? |  |  |
| OQ-003 | What are the exact delivery windows? |  |  |
| OQ-004 | What exact time counts as Tuesday/Saturday evening? |  |  |
| OQ-005 | Should customers book 90, 180, or another number of days ahead? Is the final day inclusive? |  |  |
| OQ-006 | Is pickup needed at launch or later? |  |  |
| OQ-007 | Which cities/postal-code zones can receive delivery? |  |  |
| OQ-008 | What is the fee for each delivery zone? Is there any free-delivery threshold? |  |  |
| OQ-009 | Does minimum four apply per menu item, flavour, variant, or mixed box? |  |  |
| OQ-010 | Can customers order 5, 6, or 7, or only multiples such as 4, 8, and 12? |  |  |
| OQ-011 | Which item is the exception and what is its minimum/step? |  |  |
| OQ-012 | What total-piece/value threshold requires a manual quote? |  |  |
| OQ-013 | Do website, phone, Instagram, and admin-entered orders share the four-order cap? |  |  |
| OQ-014 | Can the owner exceed capacity? Under what circumstances? |  |  |
| OQ-015 | Are custom messages, sizes, toppings, flavours, or allergy requests supported? |  |  |
| OQ-016 | How long should an Apple Pay/card checkout hold capacity? |  |  |
| OQ-017 | How long should an unpaid e-transfer hold capacity? |  |  |
| OQ-018 | What happens when an e-transfer arrives late, underpaid, overpaid, duplicated, or without a reference? |  |  |
| OQ-019 | Which bank/business account will receive e-transfer, and is Business Request Money/API access available? |  |  |
| OQ-020 | Should ordinary card payment be offered when Apple Pay is unavailable? |  |  |
| OQ-021 | Which charges/fees are refundable, and how long should each refund method take? |  |  |
| OQ-022 | Is self-service cancellation immediate or an owner-approved request? |  |  |
| OQ-023 | What happens if nobody is available, the address is wrong, or redelivery is required? |  |  |
| OQ-024 | Can a guest later attach old orders to an account after verifying email? |  |  |
| OQ-025 | How long should guest links, accounts, addresses, delivery notes, and order records be retained? |  |  |
| OQ-026 | Which homepage/contact/FAQ/policy fields should the owner edit? |  |  |
| OQ-027 | Which order stages should send email, and should Payment received and Order confirmed be one email? |  |  |
| OQ-028 | Will there be staff besides the owner at launch? What may they do? |  |  |
| OQ-029 | What is the final refund/cancellation policy text? |  |  |
| OQ-030 | What support email/phone and incident contact will be published/alerted? |  |  |

---

## 23. Future roadmap candidates

These require separate prioritization and acceptance criteria after MVP stability:

- Pickup and pickup-specific statuses/windows.
- Capacity points based on production effort rather than order count.
- Automated Interac Business Request Money integration.
- Staff roles and fulfillment-only dashboard.
- Manual quote/custom order workflow.
- Customer reorder.
- Coupons, gift cards, loyalty, tips, or deposits.
- SMS/push notifications.
- Route planning/live delivery tracking.
- Ingredient inventory and production recipes.
- Accounting/POS integration.
- Multilingual storefront.
- Multiple kitchens/service areas.

---

## 24. Reference material

Requirements and provider behaviour must be revalidated during implementation and immediately before launch.

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Stripe Apple Pay documentation](https://docs.stripe.com/apple-pay?platform=web)
- [Stripe checkout fulfillment/webhook guidance](https://docs.stripe.com/checkout/fulfillment)
- [Interac Business Request Money](https://www.interac.ca/en/payments/business/interac-e-transfer-business-request-money/)
- [CRA GST/HST registration guidance](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html)
- [CRA Basic Groceries guidance](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-3/basic-groceries.html)
- [BizPaL permit finder](https://www.canada.ca/en/services/business/permits.html)
- [CFIA Industry Labelling Tool](https://inspection.canada.ca/en/food-labels/labelling/industry)
- [Office of the Privacy Commissioner — privacy-law jurisdiction](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/)
- [CRTC CASL guidance](https://www.crtc.gc.ca/eng/com500/faq500.htm)

---

## 25. Final sign-off statement

Before development of a requirement begins, the team may use confirmed decisions and explicitly approved proposed defaults. A launch-blocking TBD must not be converted into production behaviour without a recorded owner decision. Any material change to payment, tax, fulfillment, quantity, capacity, cancellation, refund, privacy, or access rules requires a PRD revision, acceptance-test update, and impact review.
