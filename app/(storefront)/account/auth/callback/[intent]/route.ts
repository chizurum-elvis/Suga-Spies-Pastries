import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { passwordRecoveryTokenSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ intent: string }> },
) {
  const { intent } = await params;
  const signup = intent === "signup";
  const recovery = intent === "recovery";
  if (!signup && !recovery)
    return NextResponse.redirect(
      new URL("/account/login?error=invalid_link", request.url),
    );

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash) {
    if (
      type !== (signup ? "email" : "recovery") ||
      !passwordRecoveryTokenSchema.shape.tokenHash.safeParse(tokenHash).success
    )
      return NextResponse.redirect(
        new URL("/account/login?error=invalid_link", request.url),
      );
    // Email security scanners can prefetch GET links. The one-time token is
    // therefore consumed only by an explicit customer POST on the next page.
    const target = new URL(
      signup ? "/account/confirm" : "/account/recover",
      request.url,
    );
    target.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(target);
  }

  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  if (!code || getSupabaseConfigurationState().status !== "configured")
    return NextResponse.redirect(
      new URL("/account/login?error=invalid_link", request.url),
    );
  try {
    const client = await createServerSupabaseClient();
    const result = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (result.error || !result.data.user?.email_confirmed_at)
      return NextResponse.redirect(
        new URL("/account/login?error=invalid_link", request.url),
      );
  } catch {
    return NextResponse.redirect(
      new URL("/account/login?error=invalid_link", request.url),
    );
  }
  return NextResponse.redirect(
    new URL(signup ? "/account" : "/account/update-password", request.url),
  );
}
