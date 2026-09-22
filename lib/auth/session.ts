import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  resolveOwnerAccess,
  type OwnerAccessResult,
  type OwnerIdentity,
} from "@/lib/auth/owner-access";
import { buildAdminLoginPath } from "@/lib/auth/paths";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OwnerSessionState = OwnerAccessResult | { status: "configuration" };

export const getOwnerSessionState = cache(
  async (): Promise<OwnerSessionState> => {
    if (getSupabaseConfigurationState().status !== "configured") {
      return { status: "configuration" };
    }

    try {
      const supabase = await createServerSupabaseClient();
      return await resolveOwnerAccess(supabase);
    } catch {
      return { status: "unavailable" };
    }
  },
);

export async function requireOwnerSession(
  returnPath = "/admin",
): Promise<OwnerIdentity> {
  const session = await getOwnerSessionState();

  if (session.status === "authorized") {
    return session.owner;
  }

  if (session.status === "forbidden") {
    redirect("/admin/access-denied?reason=forbidden");
  }

  if (session.status === "unavailable") {
    redirect("/admin/access-denied?reason=unavailable");
  }

  redirect(
    buildAdminLoginPath(
      returnPath,
      session.status === "configuration" ? "configuration" : "auth_required",
    ),
  );
}
