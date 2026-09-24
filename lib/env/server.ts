import "server-only";

import {
  findPublicSecretNames,
  serverEnvironmentSchema,
} from "@/lib/env/schema";

export function getServerEnvironment() {
  const exposedSecretNames = findPublicSecretNames(process.env);

  if (exposedSecretNames.length > 0) {
    throw new Error(
      `Server secret names must not use NEXT_PUBLIC_: ${exposedSecretNames.join(", ")}`,
    );
  }

  return serverEnvironmentSchema.parse({
    APP_ENV: process.env.APP_ENV ?? "local",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    GOOGLE_MAPS_SERVER_API_KEY: process.env.GOOGLE_MAPS_SERVER_API_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PAYMENTS_MODE: process.env.PAYMENTS_MODE,
    CHECKOUT_POLICIES_JSON: process.env.CHECKOUT_POLICIES_JSON,
    ORDER_ACCESS_SECRET: process.env.ORDER_ACCESS_SECRET,
    PAYMENT_WORKER_SECRET: process.env.PAYMENT_WORKER_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM,
    ORDER_ALERT_EMAIL: process.env.ORDER_ALERT_EMAIL,
    ORDER_TEST_EMAIL: process.env.ORDER_TEST_EMAIL,
  });
}
