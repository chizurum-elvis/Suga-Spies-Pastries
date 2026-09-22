import { type NextRequest, NextResponse } from "next/server";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function loginErrorRedirect(request: NextRequest, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (getSupabaseConfigurationState().status !== "configured") {
    return loginErrorRedirect(request, "configuration");
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const recoveryType = request.nextUrl.searchParams.get("type");

  if (tokenHash && recoveryType === "recovery") {
    const recoveryUrl = new URL("/admin/recover", request.url);
    recoveryUrl.searchParams.set("token_hash", tokenHash);
    recoveryUrl.searchParams.set("type", recoveryType);
    return NextResponse.redirect(recoveryUrl);
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return loginErrorRedirect(request, "invalid_link");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const exchangeResult = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeResult.error) {
      return loginErrorRedirect(request, "invalid_link");
    }

    const ownerAccess = await resolveOwnerAccess(supabase);

    if (ownerAccess.status === "authorized") {
      return NextResponse.redirect(
        new URL("/admin/update-password", request.url),
      );
    }

    if (ownerAccess.status === "forbidden") {
      await supabase.auth.signOut({ scope: "local" });

      return NextResponse.redirect(
        new URL("/admin/access-denied?reason=forbidden", request.url),
      );
    }

    if (ownerAccess.status === "unavailable") {
      return NextResponse.redirect(
        new URL("/admin/access-denied?reason=unavailable", request.url),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/admin/access-denied?reason=unavailable", request.url),
    );
  }

  return loginErrorRedirect(request, "invalid_link");
}
