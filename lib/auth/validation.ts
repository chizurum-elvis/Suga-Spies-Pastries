import { z } from "zod";

const emailSchema = z
  .string({ error: "Enter a valid email address." })
  .trim()
  .max(254, { error: "Enter a valid email address." })
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform((email) => email.toLowerCase());

export const ownerSignInSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." })
    .max(1024, { error: "The password is too long." }),
  returnTo: z.string().optional(),
});

export const passwordRecoverySchema = z.strictObject({
  email: emailSchema,
});

export const passwordRecoveryTokenSchema = z.strictObject({
  tokenHash: z
    .string({ error: "The recovery link is invalid." })
    .min(16, { error: "The recovery link is invalid." })
    .max(512, { error: "The recovery link is invalid." })
    .regex(/^[A-Za-z0-9_-]+$/, { error: "The recovery link is invalid." }),
  type: z.literal("recovery", { error: "The recovery link is invalid." }),
});

export const passwordUpdateSchema = z
  .strictObject({
    password: z
      .string({ error: "Enter a new password." })
      .min(12, { error: "Use at least 12 characters." })
      .max(128, { error: "Use no more than 128 characters." })
      .regex(/[a-z]/, { error: "Add at least one lowercase letter." })
      .regex(/[A-Z]/, { error: "Add at least one uppercase letter." })
      .regex(/[0-9]/, { error: "Add at least one number." })
      .regex(/[^A-Za-z0-9]/, {
        error: "Add at least one symbol.",
      }),
    confirmPassword: z.string({ error: "Confirm the new password." }),
  })
  .superRefine(({ confirmPassword, password }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The passwords do not match.",
      });
    }
  });

export function firstFieldError(
  fieldErrors: Record<string, string[] | undefined>,
  field: string,
) {
  return fieldErrors[field]?.[0];
}
