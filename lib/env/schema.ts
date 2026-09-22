import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalHttpUrl = z.preprocess(
  emptyStringToUndefined,
  z
    .url({
      protocol: /^https?$/,
      error: "Use a complete http:// or https:// URL.",
    })
    .optional(),
);

const optionalPrefixedString = (prefix: string, label: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .startsWith(prefix, `${label} must begin with ${prefix}.`)
      .optional(),
  );

export const appEnvironmentSchema = z.enum(["local", "staging", "production"]);

export const publicEnvironmentSchema = z
  .strictObject({
    APP_ENV: appEnvironmentSchema,
    NEXT_PUBLIC_SITE_URL: optionalHttpUrl,
    NEXT_PUBLIC_SUPABASE_URL: optionalHttpUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPrefixedString(
      "sb_publishable_",
      "Supabase publishable key",
    ),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalPrefixedString(
      "pk_",
      "Stripe publishable key",
    ),
  })
  .superRefine((environment, context) => {
    const hasSupabaseUrl = Boolean(environment.NEXT_PUBLIC_SUPABASE_URL);
    const hasSupabaseKey = Boolean(
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    if (hasSupabaseUrl !== hasSupabaseKey) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message:
          "Supabase URL and publishable key must either both be present or both be absent.",
      });
    }

    if (environment.APP_ENV !== "local") {
      if (!environment.NEXT_PUBLIC_SITE_URL) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "A public site URL is required outside local development.",
        });
      } else if (
        new URL(environment.NEXT_PUBLIC_SITE_URL).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "Staging and production site URLs must use HTTPS.",
        });
      }
    }
  })
  .transform((environment) => ({
    ...environment,
    NEXT_PUBLIC_SITE_URL:
      environment.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  }));

export const serverEnvironmentSchema = z
  .strictObject({
    APP_ENV: appEnvironmentSchema,
    NEXT_PUBLIC_SITE_URL: optionalHttpUrl,
    NEXT_PUBLIC_SUPABASE_URL: optionalHttpUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPrefixedString(
      "sb_publishable_",
      "Supabase publishable key",
    ),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalPrefixedString(
      "pk_",
      "Stripe publishable key",
    ),
    SUPABASE_SECRET_KEY: optionalPrefixedString(
      "sb_secret_",
      "Supabase secret key",
    ),
    STRIPE_SECRET_KEY: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .trim()
        .regex(
          /^(sk|rk)_(test|live)_/,
          "Use a Stripe sandbox or live secret/restricted key.",
        )
        .optional(),
    ),
    PAYMENTS_MODE: z.enum(["disabled", "test", "live"]).default("disabled"),
    CHECKOUT_POLICIES_JSON: z.preprocess(
      emptyStringToUndefined,
      z.string().max(5000).optional(),
    ),
    ORDER_ACCESS_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).max(256).optional(),
    ),
    PAYMENT_WORKER_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32).max(256).optional(),
    ),
    RESEND_API_KEY: optionalPrefixedString("re_", "Resend API key"),
    ORDER_EMAIL_FROM: z.preprocess(
      emptyStringToUndefined,
      z.email().optional(),
    ),
    ORDER_ALERT_EMAIL: z.preprocess(
      emptyStringToUndefined,
      z.email().optional(),
    ),
    ORDER_TEST_EMAIL: z.preprocess(
      emptyStringToUndefined,
      z.email().optional(),
    ),
    GOOGLE_MAPS_SERVER_API_KEY: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(20).optional(),
    ),
    STRIPE_WEBHOOK_SECRET: optionalPrefixedString(
      "whsec_",
      "Stripe webhook secret",
    ),
  })
  .superRefine((environment, context) => {
    const publicResult = publicEnvironmentSchema.safeParse({
      APP_ENV: environment.APP_ENV,
      NEXT_PUBLIC_SITE_URL: environment.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });

    if (!publicResult.success) {
      for (const issue of publicResult.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });

const forbiddenPublicSecretPattern =
  /(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|SERVER_API_KEY|DATABASE_URL|WEBHOOK_SECRET)/i;

export function findPublicSecretNames(
  environment: Record<string, string | undefined>,
) {
  return Object.keys(environment).filter(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      forbiddenPublicSecretPattern.test(name),
  );
}
