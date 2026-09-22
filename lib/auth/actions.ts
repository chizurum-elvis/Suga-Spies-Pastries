"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/lib/auth/action-state";
import {
  isAuthRateLimitError,
  ownerSignInErrorMessage,
} from "@/lib/auth/errors";
import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { sanitizeAdminReturnPath } from "@/lib/auth/paths";
import {
  firstFieldError,
  ownerSignInSchema,
  passwordRecoverySchema,
  passwordRecoveryTokenSchema,
  passwordUpdateSchema,
} from "@/lib/auth/validation";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function errorState(
  message: string,
  options?: Pick<AuthActionState, "errors" | "values">,
): AuthActionState {
  return {
    status: "error",
    message,
    errors: options?.errors,
    values: options?.values,
    submissionId: randomUUID(),
  };
}

function successState(message: string): AuthActionState {
  return {
    status: "success",
    message,
    submissionId: randomUUID(),
  };
}

function integrationIsReady() {
  return getSupabaseConfigurationState().status === "configured";
}

export async function signInOwner(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = ownerSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    returnTo: formData.get("returnTo") ?? undefined,
  });

  if (!validation.success) {
    const fieldErrors = validation.error.flatten().fieldErrors;
    const email = formData.get("email");

    return errorState("Check the highlighted fields and try again.", {
      errors: {
        email: firstFieldError(fieldErrors, "email"),
        password: firstFieldError(fieldErrors, "password"),
      },
      values: { email: typeof email === "string" ? email : undefined },
    });
  }

  const { email, password, returnTo } = validation.data;

  if (!integrationIsReady()) {
    return errorState(
      "Owner sign-in is not configured yet. Add the Supabase public URL and publishable key, then restart the app.",
      { values: { email } },
    );
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return errorState(
      "Owner sign-in is temporarily unavailable. Check the configuration and try again.",
      { values: { email } },
    );
  }

  let signInResult: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >;

  try {
    signInResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  } catch {
    return errorState(
      "Owner sign-in is temporarily unavailable. Check the connection and try again.",
      { values: { email } },
    );
  }

  if (signInResult.error) {
    return errorState(ownerSignInErrorMessage(signInResult.error), {
      values: { email },
    });
  }

  let ownerAccess: Awaited<ReturnType<typeof resolveOwnerAccess>>;

  try {
    ownerAccess = await resolveOwnerAccess(supabase);
  } catch {
    await supabase.auth.signOut({ scope: "local" });

    return errorState(
      "Owner sign-in is temporarily unavailable. Try again in a moment.",
      { values: { email } },
    );
  }

  if (ownerAccess.status !== "authorized") {
    await supabase.auth.signOut({ scope: "local" });

    return errorState(
      ownerAccess.status === "unavailable"
        ? "Owner sign-in is temporarily unavailable. Try again in a moment."
        : "The email or password could not be verified for owner access.",
      { values: { email } },
    );
  }

  redirect(sanitizeAdminReturnPath(returnTo));
}

export async function requestOwnerPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = passwordRecoverySchema.safeParse({
    email: formData.get("email"),
  });

  if (!validation.success) {
    const fieldErrors = validation.error.flatten().fieldErrors;
    const email = formData.get("email");

    return errorState("Check the email address and try again.", {
      errors: { email: firstFieldError(fieldErrors, "email") },
      values: { email: typeof email === "string" ? email : undefined },
    });
  }

  const { email } = validation.data;

  if (!integrationIsReady()) {
    return errorState(
      "Password recovery is not configured yet. Add the Supabase public URL and publishable key, then restart the app.",
      { values: { email } },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const callbackUrl = new URL("/admin/auth/callback", siteUrl);

    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl.toString(),
    });

    if (result.error && isAuthRateLimitError(result.error)) {
      return errorState(
        "Too many recovery emails were requested. Wait a few minutes before trying again.",
        { values: { email } },
      );
    }

    if (result.error) {
      return errorState(
        "Password recovery is temporarily unavailable. Try again in a moment.",
        { values: { email } },
      );
    }
  } catch {
    return errorState(
      "Password recovery is temporarily unavailable. Check the connection and try again.",
      { values: { email } },
    );
  }

  return successState(
    "If that address belongs to the owner account, a secure recovery link is on its way.",
  );
}

export async function updateOwnerPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validation.success) {
    const fieldErrors = validation.error.flatten().fieldErrors;

    return errorState(
      "Use a strong password and correct the highlighted fields.",
      {
        errors: {
          password: firstFieldError(fieldErrors, "password"),
          confirmPassword: firstFieldError(fieldErrors, "confirmPassword"),
        },
      },
    );
  }

  if (!integrationIsReady()) {
    return errorState("Password recovery is not configured.");
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  let passwordWasUpdated = false;
  let sessionCloseFailed = false;

  try {
    supabase = await createServerSupabaseClient();
    const ownerAccess = await resolveOwnerAccess(supabase);

    if (ownerAccess.status !== "authorized") {
      return errorState(
        "This recovery session is no longer valid. Request a new recovery link.",
      );
    }

    const updateResult = await supabase.auth.updateUser({
      password: validation.data.password,
    });

    if (updateResult.error) {
      return errorState(
        isAuthRateLimitError(updateResult.error)
          ? "Too many attempts. Wait a few minutes before trying again."
          : "The password could not be updated. Request a new recovery link and try again.",
      );
    }

    passwordWasUpdated = true;

    try {
      const globalSignOutResult = await supabase.auth.signOut({
        scope: "global",
      });

      if (globalSignOutResult.error) {
        const localSignOutResult = await supabase.auth.signOut({
          scope: "local",
        });
        sessionCloseFailed = Boolean(localSignOutResult.error);
      }
    } catch {
      sessionCloseFailed = true;
    }
  } catch {
    if (passwordWasUpdated) {
      sessionCloseFailed = true;
    } else {
      return errorState(
        "The password could not be updated because the service is unavailable. Try again.",
      );
    }
  }

  if (sessionCloseFailed) {
    redirect(
      "/admin/access-denied?reason=password_updated_session_close_failed",
    );
  }

  if (!passwordWasUpdated) {
    return errorState(
      "The password could not be updated because the service is unavailable. Try again.",
    );
  }

  redirect("/admin/login?message=password_updated");
}

export async function confirmOwnerPasswordRecovery(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validation = passwordRecoveryTokenSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    type: formData.get("type"),
  });

  if (!validation.success) {
    return errorState(
      "This recovery link is invalid or incomplete. Request a new link.",
    );
  }

  if (!integrationIsReady()) {
    return errorState("Password recovery is not configured.");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const verificationResult = await supabase.auth.verifyOtp({
      token_hash: validation.data.tokenHash,
      type: validation.data.type,
    });

    if (verificationResult.error) {
      return errorState(
        "This recovery link is invalid, expired, or already used. Request a new link.",
      );
    }

    const ownerAccess = await resolveOwnerAccess(supabase);

    if (ownerAccess.status !== "authorized") {
      await supabase.auth.signOut({ scope: "local" });

      return errorState(
        ownerAccess.status === "unavailable"
          ? "Owner access could not be checked. Try again in a moment."
          : "This recovery link is not approved for owner access.",
      );
    }
  } catch {
    return errorState(
      "Password recovery is temporarily unavailable. Try again in a moment.",
    );
  }

  redirect("/admin/update-password");
}

export async function signOutOwner() {
  let sessionCloseFailed = false;

  if (integrationIsReady()) {
    try {
      const supabase = await createServerSupabaseClient();
      const result = await supabase.auth.signOut({ scope: "local" });
      sessionCloseFailed = Boolean(result.error);
    } catch {
      sessionCloseFailed = true;
    }
  }

  if (sessionCloseFailed) {
    redirect("/admin/access-denied?reason=session_close_failed");
  }

  redirect("/admin/login?message=signed_out");
}
