# Owner operations and release handover

## Scope and deferred items

The seven-section admin is implemented. The current approved test owner remains
unchanged. The owner requested that her real account/MFA setup, full payment
acceptance, and load testing happen later. Ingredient/allergen completion is
assigned to the owner after deployment; approval is still needed before customers
rely on those claims. Deployment is not authorization to open live ordering.

## When something fails

1. Open **Overview → Needs attention**, then **Orders**. Payment exceptions,
   failed email sends, original-payment refunds, and additional-delivery-fee
   refunds are recorded separately. Test/live order filters are intentional.
2. Open the affected order. An email failure does not undo a saved order stage.
   Use the safe retry action when offered; outside the retry window, contact the
   customer rather than repeatedly resending an ambiguous message.
3. For refunds, use **Check refund status** and read the original-payment and
   redelivery-fee sections. A closed order is not proof that the bank refund is
   complete. Do not create another manual Stripe refund without reconciling the
   existing provider reference first.
4. If automatic processing stops, **Settings** shows the stale-payment-worker
   warning. Pause new orders if needed. Existing settlement, refunds, and queued
   jobs must continue; do not delete pending attempts or release uncertain holds.
5. Escalate with the readable order number, time, action attempted, and a redacted
   screenshot. Never send a password, secret key, customer payment details, or a
   guest access link. Provider logs and the order's history are the investigation
   trail.

The dashboard is not an independent outage monitor. It cannot email a warning
using the same stopped worker and claim to detect that worker's own outage.
An independently scheduled heartbeat alert still needs configuration before a
production sign-off. No paid monitoring service is enabled by this release.

## The free-hosting scheduling constraint

`vercel.json` retains the once-daily Hobby-compatible call. Checkout still fails
closed when the payment worker's last successful check is three minutes old.
Do not increase that tolerance to a day to hide a warning: confirmations,
capacity recovery, queued stage emails, and failed-delivery deadlines need timely
processing even after a customer closes the browser.

A separately authorized scheduler can call the protected reconciliation endpoint
every minute without changing the Vercel plan. Check the project's actual
Supabase Cron/pg_net/Vault support and provider quotas before configuring it. Do
not put a Bearer secret directly in a public SQL migration or cron command. The
development command `npm run payments:worker` is useful for tests, not an always-on
production service.

## Repeatable release checks

GitHub's **Release checks** workflow runs formatting, lint, TypeScript, unit and
release-tool tests, a production build, and credential-free Chromium/mobile
WebKit smoke and synthetic order-state/axe checks. It receives no production
provider or database credentials. Connected checkout tests need an explicitly
configured test database and are not part of that credential-free CI job. The
targeted release scan rejects known private-key formats, committed environment
files, and generated private test artifacts, without printing credential values.
It does not constitute a complete security audit.

The smoke tests do not compare the macOS image baselines. Local visual comparison and
manual review remain required. Connected database rollback tests and explicitly
authorized owner/provider tests are separate, not silently treated as CI passes.
Enable required status checks/branch protection in GitHub if releases should be
blocked on workflow failure; merely adding a workflow does not make Vercel wait.

Before pushing/deploying, run:

```bash
npm run check:release
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:release
npm run test:db
npm run build -- --webpack
```

Then run browser acceptance against that exact build. Never load-test the shared
live database or trigger paid Maps calls, customer emails, or Stripe charges as a
side effect. Agree on a separate staging target and limits before the deferred
load test.

## Deploy and verify

1. Confirm the target Supabase project matches the deployment environment. Review
   migration history and apply only reviewed missing migrations; never use a
   destructive reset on the connected database.
2. Push the tested commit to the configured GitHub branch. Check Vercel's
   deployment result; a successful Git push is not proof of successful deployment.
3. Confirm the deployed `/admin` request redirects a signed-out visitor to login.
   With the approved owner, inspect all seven sections. Verify real data, empty
   states, navigation, FAQ editing, and an unavailable network/retry state.
4. Confirm correct production environment values, HTTPS, recovery URLs, email
   domain, Stripe keys/webhook, wallet domains, and Google Maps restrictions.
   Follow `production-email-setup.md` for both email integrations.
5. Perform the reversible owner checklist in `admin-workspace-completion.md` on
   staging. Record the commit, browser, date, results, and any remaining blockers.
   Do not claim real card/wallet device acceptance from mocked browser fixtures.

## Backups and rollback — must be verified, not assumed

- Check which database backups the actual Supabase plan provides. Do not assume
  free hosting includes a recoverable daily backup.
- Agree on an encrypted backup destination, responsible person, and recovery
  interval before enabling an automated export of customer information. Never
  store data dumps, Auth records, or secrets in GitHub or public test artifacts.
- Test a restoration in an isolated non-production project, with outbound email
  and payments disabled. Verify orders, items, access controls, content, and
  capacity, then record the result. Database backups do not necessarily include
  the product image objects themselves; include Storage recovery in the plan.
- Retain the previous known-good Vercel deployment. If an application release
  fails, pause new ordering and roll back the application through Vercel. Do not
  reverse database migrations blindly: old application code must remain compatible
  with the current schema, and existing payment/refund jobs must keep running.

No backup export, restore, paid plan change, or external monitoring integration is
performed merely by adding this runbook.
