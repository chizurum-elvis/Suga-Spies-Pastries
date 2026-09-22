import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { buildAdminLoginPath, isPublicAdminPath } from "@/lib/auth/paths";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

function redirectWithSessionCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname.split("?")[0] ?? pathname;
  redirectUrl.search = pathname.includes("?")
    ? `?${pathname.split("?").slice(1).join("?")}`
    : "";

  const redirectResponse = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function updateSupabaseSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath = isPublicAdminPath(pathname);
  const configuration = getSupabaseConfigurationState();

  if (configuration.status !== "configured") {
    return isPublicPath
      ? NextResponse.next({ request })
      : NextResponse.redirect(
          new URL(
            buildAdminLoginPath(
              `${pathname}${request.nextUrl.search}`,
              "configuration",
            ),
            request.url,
          ),
        );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    configuration.value.url,
    configuration.value.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, options, value }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // Keep this verification immediately after client creation. Supabase uses it
  // to validate and refresh the cookie-backed session for SSR requests.
  const { data, error } = await supabase.auth.getClaims();
  const hasVerifiedIdentity = !error && Boolean(data?.claims?.sub);

  if (!hasVerifiedIdentity && !isPublicPath) {
    return redirectWithSessionCookies(
      request,
      supabaseResponse,
      buildAdminLoginPath(
        `${pathname}${request.nextUrl.search}`,
        "auth_required",
      ),
    );
  }

  return supabaseResponse;
}
