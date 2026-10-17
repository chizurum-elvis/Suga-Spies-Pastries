import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { customerLoginPath } from "@/lib/customer/paths";

export type CustomerIdentity = { id: string; email: string };

export async function getCustomerIdentity(): Promise<CustomerIdentity | null> {
  try {
    const client = await createServerSupabaseClient();
    // getUser checks the current Auth service, unlike a cookie-only session.
    const result = await client.auth.getUser();
    const user = result.data.user;
    const email = user?.email?.trim().toLowerCase();
    if (result.error || !user || !user.email_confirmed_at || !email)
      return null;
    return { id: user.id, email };
  } catch {
    return null;
  }
}

export async function requireCustomerIdentity(returnTo = "/account") {
  const identity = await getCustomerIdentity();
  if (!identity) redirect(customerLoginPath(returnTo));
  return identity;
}
