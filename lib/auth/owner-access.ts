import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type OwnerIdentity = {
  id: string;
  email: string;
  displayName: string | null;
  role: "owner";
};

export type OwnerAccessResult =
  | { status: "authorized"; owner: OwnerIdentity }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export async function resolveOwnerAccess(
  supabase: SupabaseClient<Database>,
): Promise<OwnerAccessResult> {
  const claimsResult = await supabase.auth.getClaims();
  const subject = claimsResult.data?.claims?.sub;

  if (claimsResult.error || !subject) {
    return { status: "unauthenticated" };
  }

  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  if (userResult.error || !user || user.id !== subject) {
    return { status: "unauthenticated" };
  }

  const membershipResult = await supabase
    .from("admin_users")
    .select("user_id, role, is_active, display_name")
    .eq("user_id", subject)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipResult.error) {
    return { status: "unavailable" };
  }

  if (!membershipResult.data || membershipResult.data.role !== "owner") {
    return { status: "forbidden" };
  }

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    return { status: "forbidden" };
  }

  return {
    status: "authorized",
    owner: {
      id: membershipResult.data.user_id,
      email,
      displayName: membershipResult.data.display_name,
      role: membershipResult.data.role,
    },
  };
}
