# Owner workspace completion

Seven sections, in order: Overview, Orders, Kitchen plan, Menu, Delivery calendar,
Website content, Settings. Existing customer order/payment rules remain authoritative.

## Acceptance

- Real operational data; no placeholder health claims or development commentary.
- Live/test orders distinguishable; no browser-trusted prices or capacity.
- Kitchen quantities use immutable paid order selections and current redelivery dates.
- Calendar communicates closures, notice requirements, holds, and the four-space limit.
- Owner-only changes repeat authorization at the mutation and retain database audit rules.
- Settings never display provider secrets. Pausing new orders must not interrupt payment reconciliation or refunds.
- Existing content editing, publishing, and history remain available.
- Mobile, keyboard, empty/error states, printing, type checks, unit tests, database rollback tests, and authenticated browser verification.

## Launch dependencies outside a visual redesign

Owner-approved ingredients/allergens and legal policies; real owner account; live Stripe
and email-domain setup; reliable payment-worker scheduling; final deployed acceptance.
Do not enable live ordering or claim those dependencies are complete without evidence.

## Owner acceptance checklist

1. Sign in at `/admin/login`. Confirm the seven navigation labels are visible. On phones and tablets below 1024px, use the menu button.
2. In Overview, switch between live and test orders. Check today's deliveries, preparation count, reserved spaces, kitchen date, and sales date range.
3. In Orders, find a known test order by its number, customer name, email, and phone. Filter by delivery date, stage, and payment. Open it and print the order. Do not progress a real order just to test the control.
4. In Kitchen plan, select a date/range and live or test orders. Check pastry quantities and choices against the order details, then print the plan. Unpaid off-site records are explicitly separate.
5. In Menu, open a pastry. Review details, availability, images, and choices. Test a reversible edit in a test environment and restore it. A change made in one tab must not be overwritten silently by a stale form in another.
6. In Delivery calendar, check Wednesday/Sunday closures and notice restrictions. In a test environment, block an unused future date, confirm it disappears from customer availability, then remove the block. Existing orders must remain intact.
7. In Website content, open Frequently asked questions. Save a draft, review, publish, and check `/faq` in another tab. Publishing legal policies requires approved non-empty wording.
8. In Settings, check delivery prices and the alert destination. In a test environment, pause website orders and confirm a new checkout cannot start. Existing payment-status checks/refunds must still work. Restore the ordering setting.
9. Sign out. A fresh direct `/admin` request must return to sign-in.

Database assertions use rollback transactions and never send customer emails. The
authenticated browser inspection is read-only; it does not change order stages,
settings, prices, or public content. Screenshots are private local test artifacts.

## Implementation notes

- The two pending kitchen/external-order migrations and the new owner-workspace migration were reviewed, rollback-tested, and applied to the linked database.
- The owner workspace uses compact, scoped typography and a seven-link navigation. It does not change the storefront design system.
- Admin links do not prefetch private operational screens speculatively. Loading/error recovery stays inside the current section.
- New-order pause is checked on the server and serialized with new payment inserts in the database. It does not change existing attempts, refunds, or redelivery payments.
- Settings retain an immutable owner change history and reject stale saves. Choice edits are scoped to their pastry and their last-updated timestamp.
- The homepage feature derives its name, photo, availability, link, and price from the published catalogue instead of retaining a hard-coded advertisement.
- Live and test website orders are separated. Off-site order records are explicitly payment-unverified, not presented as Stripe-paid orders.
- Owner two-factor authentication is not added by this redesign; current sign-in, recovery, session revocation, and active-owner checks remain in force.
- No GitHub push, Vercel deployment, live-payment activation, provider billing change, or replacement of the approved owner account was performed.

## Verification — October 17, 2026

- Lint, TypeScript, formatting, whitespace checks, and the production webpack build passed.
- 564 unit/component tests passed; one optional provider test remained skipped.
- All 19 rollback-only database suites passed. The owner-workspace suite additionally verified immediate access revocation (17 assertions total).
- Authenticated Chromium and mobile WebKit acceptance passed on the final build (2 tests, 2.5 minutes). Main sections were checked at 320, 360, 390, 768, 1024, 1280, 1440, and 1920 CSS pixels.
- Serious/critical axe violations: none in the inspected states. Keyboard navigation, Escape/focus restoration, reduced motion, real order search, printing, FAQ discoverability, and non-overlapping new-pastry save controls were checked.
- The final screenshots were visually reviewed. This is admin-slice acceptance, not a live payment/device or complete production-launch certification.

## Release preparation — October 17, 2026

- Added a plain-language `owner-admin-guide.md`, the technical
  `admin-operations-and-release.md`, and detailed `production-email-setup.md`.
- Order mail uses the bakery sender name. Live checkout rejects the shared
  `resend.dev` test sender; test mail routing and existing queue safeguards remain.
- Added credential-free GitHub release checks and a targeted private-key/artifact
  scan, including cross-platform native-package lockfile validation.
- 578 unit/component tests passed, 12 release-tool tests passed, all 19 database
  suites passed, and the exact credential-free desktop/mobile smoke selection
  passed (20 browser tests). Those browser tests do not replace connected owner,
  payment-device, or load acceptance.
- The source pins the Next.js security patch at 16.3.8, sharp at 0.35.5 through
  the lockfile, and source-map-js at 1.2.2. The final cross-platform lockfile audit
  reports zero production dependency advisories.
- Large registry downloads timed out in this execution environment. The local
  framework was recovered from its original checksum-verified cache (16.3.3),
  without changing the patched manifest/lockfile. A clean `npm ci` is required
  to install the patched framework locally. GitHub release run `39049482768`
  subsequently passed the clean patched build and all 20 browser smoke tests,
  and Vercel successfully deployed commit `f6482f8`. The earlier local production
  build used 16.3.3; this is not a claim that the local install is patched.
- The free Vercel daily cron, owner account, provider billing, and payment mode
  were not changed. The owner subsequently authorized a free Supabase scheduler;
  its implementation and activation procedure are in `payment-recovery-scheduler.md`.
  Business-domain verification, actual inbox delivery, owner content completion,
  and the deferred owner/MFA/load acceptance remain launch setup, not completed
  merely because the admin code is published.

## Authorized scheduler and deployed verification — October 17, 2026

- Added a free every-minute Supabase Cron dispatcher with the existing Vercel
  daily job retained. The migration creates it inactive; the Vault credential
  and deployed signed-request support must be verified before activation.
- Discovered the hosted pg_net queue's platform-managed broad permissions during
  rollback-only security testing. The final design never queues the reusable
  worker credential: it sends a method/action-bound HMAC that expires after 60
  seconds. The dispatcher and its bounded state remain private.
- Moved the phone/Instagram order implementations to private, owner-guarded
  functions behind invoker API wrappers. The order workflow and hard four-order
  capacity remain unchanged. The updated external-order suite passed 25 assertions;
  the scheduler suite passed 32 assertions inside rollback transactions.
- 605 unit/component tests and 12 release-tool tests passed; lint, TypeScript,
  formatting and the targeted release scan passed. Existing Bearer-based Vercel
  and local development worker authentication remains supported.
- Read-only acceptance against deployed `f6482f8` passed in desktop Chromium
  and mobile WebKit, including all seven owner sections and FAQ editing at eight
  responsive widths. Remote navigation assertions wait for document content and
  check HTTP 200 rather than depending on unrelated lazy-image load events.
- `suga-spies-pastries.vercel.app` is not an owned Resend sending domain. Business
  email and actual inbox delivery still require an owned domain. Vercel Hobby's
  commercial-use restriction also needs resolution before real orders; no paid
  hosting/billing change was made.
