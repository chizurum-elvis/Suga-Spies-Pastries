"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type AuthActionState } from "@/lib/auth/action-state";
import type { DetailsActionState } from "@/lib/customer/action-state";
import { isAuthRateLimitError } from "@/lib/auth/errors";
import {
  firstFieldError,
  ownerSignInSchema,
  passwordRecoverySchema,
  passwordRecoveryTokenSchema,
  passwordUpdateSchema,
} from "@/lib/auth/validation";
import { getCustomerIdentity } from "@/lib/customer/identity";
import { safeCustomerReturnPath } from "@/lib/customer/paths";
import { profileValues, savedDetailsSchema } from "@/lib/customer/profile";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function error(
  message: string,
  errors?: AuthActionState["errors"],
): AuthActionState {
  return { status: "error", message, errors, submissionId: randomUUID() };
}
function success(message: string): AuthActionState {
  return { status: "success", message, submissionId: randomUUID() };
}
function configured() {
  return getSupabaseConfigurationState().status === "configured";
}
function callbackUrl(intent: "signup" | "recovery") {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(`/account/auth/callback/${intent}`, site).toString();
}

const registrationSchema = passwordUpdateSchema.safeExtend({
  email: passwordRecoverySchema.shape.email,
});

export async function registerCustomer(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return error("Check the highlighted fields and try again.", {
      email: firstFieldError(fields, "email"),
      password: firstFieldError(fields, "password"),
      confirmPassword: firstFieldError(fields, "confirmPassword"),
    });
  }
  if (!configured())
    return error("Account creation is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: callbackUrl("signup") },
    });
    if (result.error) {
      if (isAuthRateLimitError(result.error))
        return error(
          "Too many requests. Wait a few minutes before trying again.",
        );
      // Supabase can deliberately obscure an already registered email.
      if (result.error.code === "user_already_exists")
        return success(
          "If this address can be registered, a verification link is on its way. Already have an account? Sign in instead.",
        );
      return error(
        "We could not send the verification email just now. Please retry.",
      );
    }
    if (result.data.session) {
      await client.auth.signOut({ scope: "local" });
      return error(
        "Email confirmation must be enabled before customer accounts can be used. Please contact support.",
      );
    }
  } catch {
    return error("Account creation is temporarily unavailable. Please retry.");
  }
  return success(
    "Check your email for a verification link before signing in. You can keep shopping as a guest.",
  );
}

export async function signInCustomer(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = ownerSignInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    returnTo: form.get("returnTo") ?? undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return error("Check your email and password.", {
      email: firstFieldError(fields, "email"),
      password: firstFieldError(fields, "password"),
    });
  }
  if (!configured()) return error("Sign-in is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const signedIn = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signedIn.error) {
      return error(
        isAuthRateLimitError(signedIn.error)
          ? "Too many attempts. Wait a few minutes before trying again."
          : "The email or password could not be verified. Check your inbox if you just registered.",
      );
    }
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user?.email_confirmed_at) {
      await client.auth.signOut({ scope: "local" });
      return error(
        "Verify your email before signing in. Check your inbox for the link.",
      );
    }
  } catch {
    return error("Sign-in is temporarily unavailable. Please retry.");
  }
  redirect(safeCustomerReturnPath(parsed.data.returnTo));
}

export async function requestCustomerPasswordReset(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = passwordRecoverySchema.safeParse({ email: form.get("email") });
  if (!parsed.success)
    return error("Enter a valid email address.", {
      email: firstFieldError(parsed.error.flatten().fieldErrors, "email"),
    });
  if (!configured())
    return error("Password recovery is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: callbackUrl("recovery"),
    });
    if (result.error && isAuthRateLimitError(result.error))
      return error(
        "Too many requests. Wait a few minutes before trying again.",
      );
    if (result.error)
      return error("Recovery email could not be sent just now. Please retry.");
  } catch {
    return error("Password recovery is temporarily unavailable. Please retry.");
  }
  return success(
    "If an account uses that email, a recovery link is on its way.",
  );
}

export async function resendCustomerVerification(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = passwordRecoverySchema.safeParse({ email: form.get("email") });
  if (!parsed.success)
    return error("Enter a valid email address.", {
      email: firstFieldError(parsed.error.flatten().fieldErrors, "email"),
    });
  if (!configured())
    return error("Email verification is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: callbackUrl("signup") },
    });
    if (result.error && isAuthRateLimitError(result.error))
      return error("Please wait a few minutes before asking for another link.");
    if (result.error)
      return error("We could not send another link just now. Please retry.");
  } catch {
    return error(
      "Email verification is temporarily unavailable. Please retry.",
    );
  }
  return success(
    "If that address still needs verification, a new link is on its way.",
  );
}

const confirmationTokenSchema = passwordRecoveryTokenSchema.shape.tokenHash;

export async function confirmCustomerEmail(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const token = confirmationTokenSchema.safeParse(form.get("tokenHash"));
  if (!token.success)
    return error("This verification link is invalid. Request another one.");
  if (!configured())
    return error("Email verification is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.verifyOtp({
      token_hash: token.data,
      type: "email",
    });
    if (result.error || !result.data.user?.email_confirmed_at)
      return error(
        "This verification link expired or was already used. Request another one.",
      );
  } catch {
    return error(
      "Email verification is temporarily unavailable. Please retry.",
    );
  }
  redirect("/account");
}

export async function confirmCustomerRecovery(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const token = confirmationTokenSchema.safeParse(form.get("tokenHash"));
  if (!token.success)
    return error("This recovery link is invalid. Request another one.");
  if (!configured())
    return error("Password recovery is temporarily unavailable.");
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.verifyOtp({
      token_hash: token.data,
      type: "recovery",
    });
    if (result.error || !result.data.user?.email_confirmed_at)
      return error(
        "This recovery link expired or was already used. Request another one.",
      );
  } catch {
    return error("Password recovery is temporarily unavailable. Please retry.");
  }
  redirect("/account/update-password");
}

export async function updateCustomerPassword(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = passwordUpdateSchema.safeParse({
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return error("Choose a stronger password and try again.", {
      password: firstFieldError(fields, "password"),
      confirmPassword: firstFieldError(fields, "confirmPassword"),
    });
  }
  if (!(await getCustomerIdentity()))
    return error("This recovery session expired. Request a new email link.");
  const client = await createServerSupabaseClient();
  try {
    const updated = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (updated.error)
      return error(
        "The password could not be changed. Request a new recovery link.",
      );
  } catch {
    return error("Password recovery is temporarily unavailable. Please retry.");
  }
  // The password has already changed. A sign-out failure must not tell the
  // customer to retry the mutation or imply that the old password still works.
  try {
    const signedOut = await client.auth.signOut({ scope: "global" });
    if (signedOut.error) await client.auth.signOut({ scope: "local" });
  } catch {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  redirect("/account/login?message=password_updated");
}

export async function signOutCustomer() {
  let failed = false;
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.signOut({ scope: "local" });
    failed = Boolean(result.error);
  } catch {
    failed = true;
  }
  redirect(
    failed
      ? "/account?error=sign_out_failed"
      : "/account/login?message=signed_out",
  );
}

export async function saveCustomerDetails(
  _previous: DetailsActionState,
  form: FormData,
): Promise<DetailsActionState> {
  const parsed = savedDetailsSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    recipientName: form.get("recipientName"),
    instructions: form.get("instructions") ?? "",
    address: {
      line1: form.get("line1"),
      line2: form.get("line2") ?? "",
      city: form.get("city"),
      province: "ON",
      postalCode: form.get("postalCode"),
      country: "CA",
    },
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Check the highlighted details.",
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ),
      submissionId: randomUUID(),
    };
  const identity = await getCustomerIdentity();
  if (!identity)
    return {
      status: "error",
      message: "Please sign in again to save your details.",
      submissionId: randomUUID(),
    };
  try {
    const client = await createServerSupabaseClient();
    const result = await client
      .from("customer_profiles")
      .upsert(profileValues(identity, parsed.data), { onConflict: "user_id" });
    if (result.error) throw result.error;
  } catch {
    return {
      status: "error",
      message: "Your details could not be saved. Please retry.",
      submissionId: randomUUID(),
    };
  }
  revalidatePath("/account/details");
  return {
    status: "success",
    message:
      "Saved for your next order. We’ll still confirm your address and delivery fee at checkout.",
    submissionId: randomUUID(),
  };
}

export async function removeCustomerDetails() {
  const identity = await getCustomerIdentity();
  if (!identity) redirect("/account/login?next=%2Faccount%2Fdetails");
  const client = await createServerSupabaseClient();
  const result = await client
    .from("customer_profiles")
    .delete()
    .eq("user_id", identity.id);
  if (result.error) redirect("/account/details?message=remove_failed");
  revalidatePath("/account/details");
  redirect("/account/details?message=removed");
}
