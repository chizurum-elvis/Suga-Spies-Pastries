-- A free Supabase Cron job wakes the existing, authenticated Vercel worker.
-- No provider credentials or customer data belong in cron.job or this migration.
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table private.payment_recovery_dispatch (
  singleton boolean primary key default true check (singleton),
  request_id bigint not null,
  dispatched_at timestamptz not null default now()
);
alter table private.payment_recovery_dispatch enable row level security;
alter table private.payment_recovery_dispatch force row level security;
revoke all on private.payment_recovery_dispatch from public, anon, authenticated, service_role;

-- Invoker rights are sufficient: pg_cron runs this as postgres. No exposed
-- SECURITY DEFINER gateway and no caller-controlled destination or headers.
create function private.enqueue_payment_recovery() returns bigint
language plpgsql security invoker set search_path = '' as $$
declare worker_secret text; request_id bigint; issued_at text; nonce text; signature text;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(724901, 1701) then return null; end if;
  if exists (select 1 from private.payment_recovery_dispatch
      where dispatched_at > pg_catalog.now() - interval '55 seconds') then
    return null;
  end if;
  select decrypted_secret into worker_secret from vault.decrypted_secrets
    where name = 'suga_payment_worker_secret';
  if worker_secret is null or char_length(worker_secret) < 32
      or char_length(worker_secret) > 512 or worker_secret ~ '[[:space:][:cntrl:]]' then
    raise exception 'payment_recovery_credential_not_configured' using errcode = '22023';
  end if;
  issued_at := floor(extract(epoch from pg_catalog.clock_timestamp()))::bigint::text;
  nonce := pg_catalog.encode(extensions.gen_random_bytes(16),'hex');
  signature := pg_catalog.encode(extensions.hmac(
    'suga-payment-recovery:v1:POST:/api/internal/payments/reconcile:' || issued_at || ':' || nonce,
    worker_secret, 'sha256'), 'hex');
  request_id := net.http_post(
    url := 'https://suga-spies-pastries.vercel.app/api/internal/payments/reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Suga-Scheduler ' || issued_at || ':' || nonce || ':' || signature),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  insert into private.payment_recovery_dispatch(singleton,request_id,dispatched_at)
    values(true,request_id,pg_catalog.now())
    on conflict(singleton) do update set request_id = excluded.request_id,
      dispatched_at = excluded.dispatched_at;
  return request_id;
end;
$$;
revoke all on function private.enqueue_payment_recovery() from public, anon, authenticated, service_role;

-- Supabase owns pg_net: its PUBLIC table grants cannot be revoked by postgres.
-- Keep net out of exposed Data API schemas. Its queue contains only an expiring
-- signature, not the Vault secret, a Supabase API key, or customer information.

-- A new database must be deliberately configured with its matching deployment
-- credential before it starts dispatching. Configuration activates this one job;
-- rerunning the setup must not create duplicates or replace other Cron jobs.
do $$
declare recovery_job bigint;
begin
  recovery_job := cron.schedule('suga-payment-recovery', '* * * * *',
    'select private.enqueue_payment_recovery();');
  perform cron.alter_job(recovery_job, active := false);
end;
$$;
