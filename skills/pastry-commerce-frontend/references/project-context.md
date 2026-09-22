# Suga Spies frontend context

Read this before designing, implementing, or reviewing any Suga Spies interface. Recheck the project documents because decisions can change.

## Product and technical shape

- Product: customer ordering and owner administration for a Toronto pastry business.
- Framework: Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4.
- Structure: routes and frontend files live under root-level `app/`; do not add `src/`.
- Backend: Supabase; payment provider currently planned as Stripe.
- Storefront: mobile-first responsive web experience.
- Admin: efficient desktop/tablet experience with essential mobile actions.
- Currency: CAD.
- Business time: `America/Toronto`, never a fixed EST/EDT offset and never the customer's device time for business cutoffs.

Before writing Next.js code, read the relevant local versioned documentation. Common frontend routes include:

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
- `node_modules/next/dist/docs/01-app/02-guides/production-checklist.md`
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

Read only those relevant to the current implementation, plus any linked page required to resolve a version-specific detail.

## Authoritative business rules affecting the UI

The live source is `docs/business-owner-discovery-responses.md`, especially **Current authoritative decisions**. The items below are a frontend-oriented snapshot, not a replacement for that file.

- Guests can browse, order, pay, track, and cancel without an account.
- Accounts are optional; verified older guest orders may later be linked.
- Lead time: four Toronto calendar days; closed dates still apply after minimum notice is satisfied.
- Booking horizon: two calendar months.
- Wednesdays, Sundays, and December 25 are unavailable.
- Customers choose an exact fulfillment time. Use 30-minute selectable increments as the working default until owner acceptance testing confirms or changes it.
- Delivery is available Monday, Thursday, and Friday from 6:00 a.m.–7:00 p.m. On Tuesday and Saturday it begins at 6:00 a.m., but the selected time must be earlier than 4:00 p.m.; exactly 4:00 p.m. is unavailable.
- Delivery only: pickup was withdrawn on September 10, 2026.
- No pickup choices, meeting-place requests, pickup approvals or collection fallback. Never reveal the owner's home address.
- Delivery is limited to Toronto, Markham, and Mississauga and to route distances of no more than 30 km.
- Checkout accepts valid Canadian phone numbers only. Use a Canada (`+1`) calling-code selector and Ontario/Canada address selectors; keep the same restrictions enforced by server validation.
- Calculate route distance privately from postal code `M1W 2Y3`. This is protected business configuration, never public business content. Google Address Validation and Routes run on the server.
- The temporary working delivery fee is CAD $5.00 for up to 3 km, then CAD $1.50 per additional kilometre through 30 km. The owner will replace this monetary formula later. Read it from protected server-managed configuration and never hard-code these amounts into components. Until it changes, charge fractional extra distance proportionally and round the final fee to cents.
- Delivery is free when products and paid customizations total at least CAD $100, excluding delivery. Free delivery never bypasses the allowed-city or 30-km limits.
- Maximum capacity is four confirmed orders per fulfillment day across website, phone, Instagram, and admin orders. There is no override.
- Wallet checkout temporarily holds capacity for 15 minutes.
- Applicable mixed boxes require four total pieces, then increase one at a time. Regular cheesecake minimum is one; mini cheesecakes minimum is four.
- All products can expose configured customizations. Decorations for cakes, cookies, and cupcakes and non-plain cheesecakes can add price.
- Apple Pay and Google Pay are the only launch payment methods. Do not implement e-transfer or ordinary manual card entry.
- Checkout does not calculate, display, or collect tax. The final total is the authoritative pastry subtotal plus the confirmed delivery fee.
- Unsupported wallet environments need an honest compatibility state; never render a fake wallet button.
- Verified provider confirmation—not a browser success redirect—creates the paid, confirmed order.
- Eligible cancellation uses the final 24-hour cutoff, happens immediately, releases capacity, and refunds the full paid amount to the original wallet-funded method.
- After a failed delivery, redelivery requires a new delivery fee. The former collection fallback is withdrawn; confirm the unclaimed-order policy before implementing that later slice.
- Customer status emails are expected for applicable order/fulfillment stages except separate refund emails.
- Only the owner uses admin at launch.
- The temporary public support number is managed business content, not a hard-coded component constant.

## Product vocabulary

Use **fulfillment date** for the date pastries are needed and **placed at** for when checkout completed. Do not call both concepts “order date.”

Keep these states distinct:

- payment state: processing, paid, failed, refund pending, refunded;
- order state: confirmed, cancelled, completed;
- fulfillment state: received, preparing, ready, out for delivery, delivered, failed delivery. Final discard handling awaits owner confirmation.

Customer-facing wording can be warmer, but it must not merge or misrepresent these lifecycles.

## Design assumptions still awaiting owner assets

Do not invent a permanent brand identity. The final visual system still depends on:

- confirmed business name styling and logo;
- packaging and existing social-media visual language;
- owner-approved colours;
- real product photography;
- final menu, options, prices, ingredients, and allergens;
- tone-of-voice examples.

Until those arrive, use reversible design tokens and clearly labelled representative content. Do not bake temporary colours, fonts, photos, or wording into unrelated component logic.

## Payment presentation constraint

The wallet-only decision has a real conversion consequence. Apple Pay and Google Pay appear only in eligible environments. Follow current Stripe, Apple, and Google requirements when implementing or styling wallet UI. If neither wallet is available, explain that the device or browser cannot use the supported payment methods and provide a safe return/contact path; do not imply the order was placed or reserve capacity indefinitely.

Current primary references:

- [Stripe Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element)
- [Apple Pay Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pay)
- [Google Pay web brand guidelines](https://developers.google.com/pay/api/web/guides/brand-guidelines)

Recheck these before payment implementation because wallet availability and branding rules change.
