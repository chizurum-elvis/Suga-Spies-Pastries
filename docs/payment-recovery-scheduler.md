# Payment recovery scheduling

## What runs

The owner authorized Supabase Cron on the existing free project. The named job
`suga-payment-recovery` runs `select private.enqueue_payment_recovery();` every
minute. It invokes the existing POST worker at:

`https://suga-spies-pastries.vercel.app/api/internal/payments/reconcile`

This stable HTTPS deployment alias remains usable after adding a custom domain.
The job recovers accepted payments, pending refunds, order emails and
failed-delivery deadlines through their existing database leases and provider
idempotency checks. It does not place new orders, change payment mode, approve
policies, or bypass the four-order capacity. The daily Vercel Hobby job is retained
as a redundant fallback, not relied on for timely processing.

One invocation per minute is about 43,200 invocations in 30 days. No paid scheduler
or plan upgrade is enabled; monitor the actual Supabase and Vercel usage quotas.
Paused projects, hosting outages and quota exhaustion can still interrupt it.
Vercel Hobby's non-commercial-use restriction remains separate: use compliant
hosting before opening this bakery's real orders. No paid hosting change is
authorized or performed by setting up the Supabase job.

## Credential and transport security

- The Vault secret named `suga_payment_worker_secret` must match either private
  `PAYMENT_WORKER_SECRET` or `CRON_SECRET` in the deployed Vercel environment.
  Prefer the worker secret. Never use a Supabase service key or Stripe key here.
- The dispatcher has invoker rights, an empty search path and a fixed destination.
  Anonymous, authenticated and application-service roles cannot execute it or
  read its private, one-row dispatch state. Only the intended database scheduler
  role can do so.
- Hosted pg_net's queue has platform-managed broad grants that cannot be revoked
  by the project role. Vault alone does **not** keep a reusable Bearer token
  private once placed in that queue. Therefore the queued request contains only
  an HMAC-SHA256 signature, issuance timestamp and random nonce, never the signing
  secret. Keep `net`, `vault` and `private` out of the exposed Data API schemas.
- The signature is bound to version 1, POST and this reconciliation action. The
  application rejects tampering, age over 60 seconds and clocks over five seconds
  in the future. Retries within that short window may occur; existing transactional
  claims/idempotency prevent a replay from making a second payment or refund.
- The fixed signing message is
  `suga-payment-recovery:v1:POST:/api/internal/payments/reconcile:<unix-seconds>:<32-character-lowercase-hex-nonce>`.
  The authorization scheme is `Suga-Scheduler`, followed by timestamp, nonce and
  lowercase hex signature separated by colons. This is not a customer session.
- Dispatches less than 55 seconds apart are skipped. HTTP requests time out after
  55 seconds, below the route's 60-second limit. A queue delayed beyond the signing
  window fails closed and the next scheduled minute creates a fresh signature.

Official guidance: [Cron with Vault and pg_net](https://supabase.com/docs/guides/functions/schedule-functions)
and [pg_net queued-header permissions](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

## Initial setup or secret rotation

1. Deploy the application version supporting signed scheduler authentication.
2. In the connected Supabase project's **Integrations → Vault**, create or update
   the exact secret name `suga_payment_worker_secret` using the deployed worker
   secret. It must be 32–512 characters without whitespace/control characters.
   Do not paste it into chat, a migration, a Cron command or a public variable.
3. In **Integrations → Cron**, locate the existing `suga-payment-recovery` job.
   Keep the schedule `* * * * *`, command
   `select private.enqueue_payment_recovery();` and role `postgres`. Enable it.
   Do not create another copy of the job or change unrelated cleanup jobs.
4. For rotation, first deploy with the new worker secret, then update Vault.
   The existing `CRON_SECRET` can remain a second independent accepted credential;
   rotate it separately if it was exposed. A short transition may return 401;
   verify a new successful run before opening new ordering.
5. Check the actual HTTP result and fresh heartbeat as below. A successful Cron
   SQL status proves only that a request was queued, not that the worker ran.

## Read-only verification and troubleshooting

Run as the project administrator in Supabase SQL Editor. This returns only
scheduling metadata, HTTP status and the payment heartbeat, not credentials,
queued headers, response bodies or customer details:

```sql
select jobname, schedule, active from cron.job
where jobname = 'suga-payment-recovery';

select d.dispatched_at, r.status_code, r.timed_out,
  (r.error_msg is not null) as transport_error
from private.payment_recovery_dispatch d
left join net._http_response r on r.id = d.request_id;

select mode, checked_at from public.payment_worker_health;
```

Verify at least two different consecutive dispatches return HTTP 200, and that
the heartbeat for the configured Stripe key's mode stays under three minutes old.
An empty queue is normal after its requests have been picked up.

- **401:** credential mismatch, old application version, signature delayed over
  60 seconds or unacceptable clock skew. Never debug by printing headers.
- **503/timeout:** inspect protected server/provider logs, database connectivity
  and work queues. Do not reset payment attempts, release uncertain capacity or
  create manual duplicate refunds.
- **No fresh dispatch:** check Cron active state, project pause/quota, Vault secret
  name and database Cron run history. The missing-credential error is intentionally
  generic and contains no credential values.
- **HTTP 200 but stale heartbeat:** inspect the response's failure counts and
  order queues as an authorized operator. A request can finish with failed work;
  a successful transport is not a successful payment/refund or guaranteed email
  delivery. The admin Settings warning remains the fail-closed signal.

To pause only this job, disable it in Cron; do not delete extensions, pending
requests or other jobs. Checkout intentionally blocks once the successful
heartbeat is stale. Resume and verify recovery before accepting orders again.

This scheduler is not an independent outage monitor or backup system. External
heartbeat alerts and a tested backup/restore destination remain separate launch
safeguards; no paid monitoring or export of customer information is configured.

## Tests

`payment_recovery_scheduler_test.sql` is rollback-only: no HTTP request can leave
its transaction. It checks the named job, permissions, missing/invalid credentials,
header injection, fixed destination, signature format/HMAC, retry suppression and
bounded dispatch state. Unit tests cover the independent Node verifier, expired
and future signatures, altered nonce/timestamp/key, wrong method/action/version
and the existing Bearer-based Vercel/development worker. An actual scheduled HTTP
200 and advancing heartbeat must additionally be checked against the deployment.
