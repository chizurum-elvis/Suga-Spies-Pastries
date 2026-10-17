# Owner-editable website content

The owner can edit the optional announcement bar, homepage welcome/story copy, public support details, FAQs, and three legal-policy drafts under `/admin/content`. The menu, delivery pricing, capacity, private route origin, and payment configuration are deliberately separate.

## Finding the FAQ editor

Sign in at `/admin/login`, open **Website content**, then choose **Frequently asked questions → Edit content**. The direct editor URL is `/admin/content/faq`; the public `/faq` page is intentionally read-only. Use **Save draft**, then **Publish version** when the wording is ready for customers.

On tablet and smaller laptop widths, sidebar labels appear below their icons rather than being hidden. The sidebar scrolls on short screens so its final links remain reachable. On mobile, use **Open admin navigation** to find the same **Website content** link. These navigation changes, like the editor routes, must be deployed before appearing on the hosted site.

## Publication model

- `site_content_drafts` is owner-only. Saving a draft does not change what customers see.
- `site_content_publications` stores every public version. The old version remains addressable; a trigger prevents editing historical published text.
- Publication is one database transaction through `publish_site_content`, guarded by the active owner allow-list, row-level security, and an expected draft version. A stale tab cannot publish over a newer edit.
- Public rendering accepts plain text and structured FAQ data only; no owner-supplied HTML or scripts are interpreted.
- Homepage, footer, FAQ, contact, checkout support links, tracking support links, and customer notification phone numbers read the published contact/content record. Public cache invalidation follows publication.
- If the saved version is already public, **Refresh public pages** safely retries cache invalidation without changing content or adding another published revision. This also recovers from an interrupted publication response.
- The initial homepage, contact number, and six practical FAQs are seeded from the existing site and current business rules. Terms, privacy, and refund policy drafts begin blank and are **not** public.

## Checkout policies

The owner must supply and approve the final legal wording. Publishing one or two policy pages does not activate them at checkout. Once **all three** are published on an HTTPS site, checkout links to each immutable `?v=` revision and records the combined policy version in the payment snapshot. Existing approved `CHECKOUT_POLICIES_JSON` links remain the fallback until a complete on-site set exists. Without either an approved configured set or a complete published set, live payment stays blocked.

Published policy prose does not alter the actual cancellation/refund engine. If that rule changes, its code, checkout wording, and policy text require a coordinated release and owner approval. Historical paid orders retain their original payment snapshot and published policy revisions.

## Owner acceptance check

1. Apply the migration and verify the database tests.
2. Sign in as the owner and open **Website content**.
3. Edit the FAQ or welcome copy and save. Confirm the public page is unchanged.
4. Publish the saved draft. Refresh the public page and confirm the change appears.
5. Restore an earlier published version as a draft; confirm the public page remains unchanged until that restored draft is published.
6. Use a different display format for the same valid Canadian support number and publish; verify `/contact`, the footer, checkout help, order tracking, and a sandbox status email use it. Restore the intended formatting afterward. Do not temporarily direct customers to someone else's number.
7. Check that a guest cannot read drafts or publish, and an owner with an outdated tab receives a stale-version error.
8. Do not publish legal policies until their final wording has been reviewed and approved. Once published, test the checkout links and the versioned older URLs.

## Verification and activation status — October 16, 2026

The unit/component suite passed (495 tests; one unrelated opt-in network test skipped), as did lint, type checking, formatting, and the production build. The content migration ran successfully in an isolated PostgreSQL database with a minimal Auth fixture. Permission, immutable-history, blank-policy, stale-version, revoked-owner, concurrent-edit, and repeated-publication checks passed there. This isolated database was stopped and removed afterward.

Public FAQ/contact routes passed desktop Chromium and mobile WebKit checks, including keyboard interaction, serious/critical accessibility scans, reduced motion, and overflow checks from 320px through 1920px. Updated storefront screenshots reflect the optional announcement bar and new footer links.

After CLI authentication, `20261016090649_owner_editable_site_content.sql` was applied transactionally to the linked Supabase project and recorded in its migration history. All 20 connected-database assertions in `supabase/tests/site_content_test.sql` passed inside a rollback-only transaction. The security advisor reported no content-related findings; its existing leaked-password-protection warning remains separate from this feature.

The real authenticated owner acceptance test passed against that database using the existing approved test owner. It verified private draft saving, public publication, footer/contact propagation, restoring a previous version, and restoration on the public page. Only the display formatting of the existing support number was changed temporarily; the original contact content was restored. The authenticated editor was visually inspected on desktop and at 320px. No password was changed or email sent, and the isolated test session was signed out afterward. Checkout/tracking/email propagation is covered by source and unit tests; a live customer notification was not sent during this check.

For an explicitly authorized repeat against the approved **test** owner only:

```bash
RUN_OWNER_CONTENT_ACCEPTANCE=1 OWNER_TEST_EMAIL=approved-test-owner@example.com node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/e2e/content-owner.spec.ts --project=chromium-desktop --reporter=line
```

The test refuses to overwrite an existing unpublished contact draft. It creates temporary published revisions while verifying the flow, then restores the original content; do not run it casually against the business owner's account.

Only this feature's migration was activated. The older local migrations `20261003152035_production_redelivery_date_index.sql` and `20261003161000_external_orders.sql` remain unapplied and require separate review before a future broad database push. No unrelated migrations were applied.

The code still needs normal deployment before this feature appears on the hosted site; this verification did not push to GitHub or trigger a deployment. No new environment variable is required. The currently approved test owner can sign in at `/admin/login` and open **Website content**. The sister must have her own approved owner membership before using her own email; ordinary customer registration does not grant admin access.

## Navigation follow-up — October 17, 2026

A read-only inspection of the actual hosted admin confirmed that its sidebar still shows **Business settings**, not **Website content**, and its authenticated `/admin/content/faq` route returns 404. The deployment is behind the local content implementation; refreshing that older deployment cannot add the missing route.

The local compact sidebar previously hid every navigation label between 768px and 1279px. It now keeps labels visible beneath the icons, and the sidebar scrolls on short screens. Mobile navigation retains the same content link and no longer claims that order data is unconnected.

The read-only `tests/e2e/admin-content-navigation.spec.ts` passed in desktop Chromium and mobile WebKit against the existing approved test owner. Each run checked the full path from the owner overview through **Website content** to editable FAQ fields at widths 320, 390, 767, 768, 1024, 1280, 1440, and 1920px, plus sidebar reachability at 1024×420. Checks included keyboard activation, mobile Escape/focus restoration, no horizontal overflow, and no serious/critical axe findings at representative widths. Screenshots of the real editor were visually inspected. No draft, publication, order, password, or owner membership was changed; the temporary sessions were signed out.

All 499 unit/component tests passed (one opt-in network test skipped), together with lint, type checking, formatting, and the production build. No GitHub push or Vercel deployment was made.

To repeat the read-only navigation test with explicit approval for the existing test owner:

```bash
RUN_OWNER_NAVIGATION_ACCEPTANCE=1 OWNER_TEST_EMAIL=approved-test-owner@example.com node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/e2e/admin-content-navigation.spec.ts --project=chromium-desktop --project=webkit-mobile --workers=1 --reporter=line
```
