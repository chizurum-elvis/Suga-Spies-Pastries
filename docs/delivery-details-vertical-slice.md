# Delivery-only contact, address and pricing slice

## Scope and boundary

Implemented September 10, 2026. The customer flow is now product → cart → delivery date/time → `/checkout/details` → address/fee review. The owner manages rates at `/admin/delivery` and closures/capacity at `/admin/availability`.

Pickup, pickup hours, public meeting points and location approval are withdrawn. Historical migrations and discovery answers remain as history; new database constraints and active code allow only delivery. No existing order is silently converted into delivery.

This is not payment checkout yet. Saving or confirming details does not take money, reserve capacity, place an order or send an order-confirmation email. Final payment review, Stripe wallet payment/webhooks and paid-order conversion are the next slice. Customer accounts are not required and the existing owner authentication is unchanged.

## Customer experience

- Contact name, email, normalized North American phone number, recipient name, street, optional unit, city, Ontario/Canada, Canadian postal code and optional delivery instructions.
- Native address/contact autofill, visible labels, field errors, focused error summary, loading and retry states.
- Entered details survive refresh and provider failure through a protected server-side draft, not local storage.
- Google checks the complete address; the server uses its verified locality, not the customer's unverified city claim, for eligibility. Toronto borough locality aliases are recognized explicitly, not with fuzzy matching.
- The server calculates a driving route, applies the distance ceiling, then computes a CAD fee in integer cents. Free delivery never bypasses the distance or city checks.
- Customers review the returned address and fee explicitly. Editing details immediately hides the old quote. Expired quotes, changed rates/cart/prices, unavailable dates, and conflicting tab edits require fresh review.
- The summary scrolls normally; it is not sticky. The existing white/purple pastry design and shared components are retained.

## Google setup — required for live address checks

1. In the business's Google Cloud project, enable billing, **Address Validation API** and **Routes API**.
2. Create a dedicated server API key. Restrict its API access to those two services; add server/IP restrictions where the hosting environment has stable egress. Do not use HTTP-referrer restrictions for this server key.
3. Add `GOOGLE_MAPS_SERVER_API_KEY` to `.env.local` and restart Next.js. Add a separate key in each deployment environment. Do not paste it in chat or use a `NEXT_PUBLIC_` name.
4. Set API quotas and billing alerts in Google Cloud. Application-level limits are shared in Postgres (8 quote attempts per draft/minute and 500 globally per UTC day); they supplement, not replace, Google's quotas. Each successful quote can make two paid API calls. Budgets alone are alerts, not hard spending caps.
5. Test with real, authorized Canadian addresses in each delivery city. Provider unit tests and browser stubs do not establish live Google account readiness.

No browser Maps SDK, Places autocomplete, map tiles, geolocation permission or browser Google key is needed for this slice. Customers enter an address normally; server-side validation and routing supply the delivery check without shipping a heavy map or exposing the origin. There is no fallback that invents a route or accepts an unverifiable address.

The private working origin is the owner-supplied postal code, not a precise street-level dispatch point. Before commercial distance billing, verify that postal-code routing is acceptable to the owner or provide a more precise **private** origin. Do not display the origin, coordinates, route geometry, or raw Google responses to customers.

Google configuration and use follow [Address Validation requests](https://developers.google.com/maps/documentation/address-validation/requests-validate-address), [Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions), and [API security guidance](https://developers.google.com/maps/api-security-best-practices).

## Pricing and quote integrity

The migration seeds the provisional owner-approved rates: $5 through 3 km; proportional $1.50/km beyond that; no deliveries beyond 30 km; free delivery from $100 in products and paid options, excluding delivery. The owner can change the monetary values, base distance, threshold and distance ceiling (up to 30 km) in the dashboard. No component hard-codes these rates.

Quotes are currently valid for 15 minutes and tied to a hashed-cookie checkout draft, exact draft/details versions, saved cart and current catalogue price fingerprints, and the delivery configuration version. This quote lifetime is distinct from the later 15-minute payment capacity hold. Subtotal plus delivery is the final payable total once the address quote is confirmed.

`mutate_delivery_details` locks the draft/details and checks expected versions and current configuration before saving a quote or confirmation. A slow provider response cannot overwrite a newer edit. Rate changes are audited with old/new configuration excluding the origin. Owner actions require live owner membership and normal Supabase RLS, not a privileged browser client.

## Privacy and data lifecycle

- Routes and Address Validation keys stay on the server. Names, email, phone and delivery notes are not sent to Google; only the address required for validation/routing is sent.
- Only server endpoints can read or change guest delivery details after verifying the opaque HttpOnly checkout cookie. Browser-supplied draft IDs, distances, fees and totals are rejected.
- Responses are private/no-store. Mutations require same-origin bounded JSON. Upstream errors are not forwarded or logged with private payloads.
- Raw route distances, geometry, coordinates and full provider responses are not persisted. The server keeps its own calculated fee, fingerprints and short-lived address suggestion.
- An hourly Supabase Cron job clears expired provider verification quotes. It does not delete customer-entered contact/address data. The original seven-day checkout access expiry remains; a legally approved customer-data retention schedule is still a launch requirement.
- The frontend includes Google attribution and links. Publish the business's approved Terms and Privacy Policy before public Google-enabled checkout; links to Google's policies are not a substitute for the business's own policies. Review [Google's policies](https://developers.google.com/maps/documentation/address-validation/policies) and [service-specific retention terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) for the billing account's jurisdiction.

## Database rollout

Migration: `20260910085254_delivery_details_and_delivery_only.sql`.

It retires pickup-only hours/closures, narrows active scheduling constraints, preserves obsolete drafts as expired rather than converting them, creates the protected delivery tables/RPCs, and schedules cleanup. Historical migrations must not be rewritten. A rollback-transaction test preceded the linked database push.

New tables: `delivery_settings`, `checkout_delivery_details`, `delivery_audit_events`, `delivery_request_limits`. RLS is enabled and forced, privileges are explicitly restricted, customer details have no browser-role access, and sensitive functions have an empty search path and restricted execution.

## How to test

1. Add an available pastry to the cart. Select **Choose delivery date**, choose an open day/time and save it. Select **Continue to delivery details**.
2. Submit the empty form. Errors should be labelled and focus should move to the error summary.
3. Fill contact/address fields. Select **Save and check delivery**. Without the Google key, details are saved and the verification step explains that it is unavailable; refresh to verify persistence.
4. With Google configured, check a real in-area address. Review Google's address and delivery fee, then select **Confirm address and delivery fee**. The page must say the order has **not** been placed.
5. Edit the address: the old fee must disappear. Change cart quantities or delivery date: a fresh validation is required. Two tabs must not silently overwrite each other's details.
6. Check a valid address outside the allowed cities and one beyond 30 km. Neither may pass, even with a $100+ cart.
7. Verify $99.99 vs $100, exactly 3 km vs over 3 km, and exactly 30 km vs over 30 km in unit tests. Test real route results where possible rather than assuming postal proximity equals driving distance.
8. As owner, open `/admin/delivery`, note the current rate, change it, verify an existing quote becomes stale, then restore the original rate. These are quote updates, not changes to paid orders.
9. Use keyboard only and widths from 320px upward; no horizontal clipping or sticky summary. Google failure must not clear the form or create a fake confirmation.

Automated checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run format:check`, production build, Playwright, and the transactional `supabase/tests/delivery_details_test.sql`. Google responses are mocked only inside tests, never via a production bypass. The SQL test collects every TAP assertion and raises on any failure so the CLI cannot hide failed intermediate results.

## Verification evidence — September 10, 2026

- TypeScript, ESLint, formatting and 238 unit tests passed.
- Combined Chromium desktop / WebKit mobile suite: 43 passed, 5 intentionally skipped by the existing device-specific test configuration. Includes six new delivery-flow tests.
- Thirty delivery database/RLS assertions passed before and after migration. All eleven existing catalogue/fulfillment database suites also passed with rollback and fail-on-any-assertion reporting.
- Live capacity concurrency: exactly one of five requests claimed the last available space; test reservations were cleaned up.
- Production build passed with `APP_ENV=production npm run build -- --webpack`. Turbopack cannot bind its worker port in this execution sandbox; application code was not changed to work around that restriction.
- Browser tests used the production build with `APP_ENV=local` at runtime because the local site URL uses HTTP. Production/staging configuration continues to require HTTPS.
- Customer delivery screens were visually inspected on desktop and mobile; responsive checks covered 320–1920px, 200% zoom, keyboard submission and axe. The real signed-in owner pricing screen was inspected on desktop and at 320 CSS pixels. Existing pastry art direction and a non-sticky checkout summary were retained per the frontend skill.
- Migration history is up to date. The Google-verification cleanup job is active. No active payment holds remain from testing.
- Sixteen synthetic delivery checkout drafts created by browser tests were removed afterward using their test-only email/recipient markers. No real orders were deleted; rerunning the tests recreates the fixtures.
- The security advisor reports no new database warnings. The pre-existing Supabase Auth **Leaked Password Protection Disabled** warning remains a launch hardening item.
- Google adapter responses were mocked in tests. Live Google verification/routing and live billing behavior are not yet verified because `GOOGLE_MAPS_SERVER_API_KEY` has not been provided. No real payment was attempted.

## Remaining launch inputs

- Google server key and live account/API verification.
- Final replacement delivery rates (the current rates are deliberately provisional).
- Approved business privacy/terms/retention wording and final failed-delivery policy without collection.
- Stripe wallet-only payment and verified webhook/order conversion in the next slice.
