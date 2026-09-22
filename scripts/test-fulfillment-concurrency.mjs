import { randomBytes, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.",
  );
}

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const created = {
  adjustmentIds: [],
  draftIds: [],
  capacityDate: null,
  capacityDayExisted: false,
};

function localDateInToronto(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, amount) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return shifted.toISOString().slice(0, 10);
}

function isoWeekday(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function randomHash() {
  return randomBytes(32).toString("hex");
}

function requireResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data ?? [];
}

async function chooseIsolatedDate() {
  const start = addDays(localDateInToronto(), 7);
  const end = addDays(start, 28);
  const [hoursResult, blackoutsResult, adjustmentsResult, holdsResult] =
    await Promise.all([
      supabase
        .from("fulfillment_hours")
        .select("iso_weekday")
        .eq("fulfillment_method", "delivery")
        .eq("is_enabled", true),
      supabase
        .from("fulfillment_blackouts")
        .select("fulfillment_date, scope")
        .gte("fulfillment_date", start)
        .lte("fulfillment_date", end),
      supabase
        .from("capacity_adjustments")
        .select("fulfillment_date")
        .gte("fulfillment_date", start)
        .lte("fulfillment_date", end),
      supabase
        .from("capacity_holds")
        .select("fulfillment_date")
        .gte("fulfillment_date", start)
        .lte("fulfillment_date", end),
    ]);
  const hours = requireResult(hoursResult, "Loading delivery hours");
  const blackouts = requireResult(blackoutsResult, "Loading blackouts");
  const adjustments = requireResult(adjustmentsResult, "Loading adjustments");
  const holds = requireResult(holdsResult, "Loading holds");
  const openDays = new Set(hours.map((entry) => entry.iso_weekday));

  for (let offset = 0; offset <= 28; offset += 1) {
    const date = addDays(start, offset);
    if (!openDays.has(isoWeekday(date)) || date.endsWith("-12-25")) continue;
    if (adjustments.some((entry) => entry.fulfillment_date === date)) continue;
    if (holds.some((entry) => entry.fulfillment_date === date)) continue;
    const blocked = blackouts.some(
      (blackout) =>
        blackout.fulfillment_date === date && blackout.scope === "delivery",
    );
    if (!blocked) return { date };
  }
  throw new Error("No isolated fulfillment date was available for the test.");
}

async function cleanup() {
  const errors = [];
  if (created.draftIds.length) {
    const holdDelete = await supabase
      .from("capacity_holds")
      .delete()
      .in("checkout_draft_id", created.draftIds);
    if (holdDelete.error) errors.push(holdDelete.error.message);
    const draftDelete = await supabase
      .from("checkout_drafts")
      .delete()
      .in("id", created.draftIds);
    if (draftDelete.error) errors.push(draftDelete.error.message);
  }
  if (created.adjustmentIds.length) {
    const adjustmentDelete = await supabase
      .from("capacity_adjustments")
      .delete()
      .in("id", created.adjustmentIds);
    if (adjustmentDelete.error) errors.push(adjustmentDelete.error.message);
    const auditDelete = await supabase
      .from("fulfillment_audit_events")
      .delete()
      .eq("entity_table", "capacity_adjustments")
      .in("entity_id", created.adjustmentIds);
    if (auditDelete.error) errors.push(auditDelete.error.message);
  }
  if (created.capacityDate && !created.capacityDayExisted) {
    const dayDelete = await supabase
      .from("capacity_days")
      .delete()
      .eq("fulfillment_date", created.capacityDate);
    if (dayDelete.error) errors.push(dayDelete.error.message);
  }
  if (errors.length) {
    throw new Error(`Concurrency test cleanup failed: ${errors.join("; ")}`);
  }
}

async function run() {
  const { date } = await chooseIsolatedDate();
  created.capacityDate = date;
  const existingDay = await supabase
    .from("capacity_days")
    .select("fulfillment_date")
    .eq("fulfillment_date", date)
    .maybeSingle();
  if (existingDay.error) throw new Error(existingDay.error.message);
  created.capacityDayExisted = Boolean(existingDay.data);

  const runId = randomUUID();
  const adjustmentResult = await supabase
    .from("capacity_adjustments")
    .insert(
      ["phone", "instagram", "other"].map((source) => ({
        fulfillment_date: date,
        source,
        internal_note: `Automated concurrency test ${runId}`,
      })),
    )
    .select("id");
  const adjustmentRows = requireResult(
    adjustmentResult,
    "Creating three prerequisite capacity entries",
  );
  created.adjustmentIds.push(...adjustmentRows.map((row) => row.id));

  const expiresAt = addDays(date, 1) + "T23:59:59.000Z";
  const draftRows = Array.from({ length: 5 }, () => ({
    id: randomUUID(),
    access_token_hash: randomHash(),
    cart_payload: { version: 1, lines: [] },
    cart_fingerprint: randomHash(),
    cart_validation_snapshot: { subtotalCents: 0, lines: [] },
    pricing_fingerprint: randomHash(),
    fulfillment_method: "delivery",
    fulfillment_date: date,
    expires_at: expiresAt,
  }));
  const draftResult = await supabase
    .from("checkout_drafts")
    .insert(draftRows)
    .select("id");
  const insertedDraftRows = requireResult(
    draftResult,
    "Creating isolated checkout drafts",
  );
  created.draftIds.push(...insertedDraftRows.map((row) => row.id));

  const attempts = await Promise.all(
    created.draftIds.map((draftId) =>
      supabase.rpc("reserve_fulfillment_capacity", {
        p_checkout_draft_id: draftId,
        p_idempotency_key: randomUUID(),
      }),
    ),
  );
  const successes = attempts.filter(
    (attempt) => !attempt.error && attempt.data?.length === 1,
  );
  const capacityRejections = attempts.filter(
    (attempt) =>
      attempt.error?.message ===
      "The fulfillment date has reached its four-order capacity.",
  );
  if (successes.length !== 1 || capacityRejections.length !== 4) {
    throw new Error(
      `Expected one success and four capacity rejections; received ${successes.length} and ${capacityRejections.length}.`,
    );
  }

  const activeHoldResult = await supabase
    .from("capacity_holds")
    .select("id", { count: "exact" })
    .in("checkout_draft_id", created.draftIds)
    .eq("status", "active");
  if (activeHoldResult.error) throw new Error(activeHoldResult.error.message);
  if (activeHoldResult.count !== 1) {
    throw new Error(
      `Expected one active hold; received ${activeHoldResult.count}.`,
    );
  }

  console.log(
    "Fulfillment concurrency passed: exactly 1 of 5 requests claimed the final daily space.",
  );
}

let failure;
try {
  await run();
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    failure ??= cleanupError;
  }
}

if (failure) throw failure;
