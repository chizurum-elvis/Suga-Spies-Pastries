import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireOwnerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OwnerWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const owner = await requireOwnerSession("/admin");

  return <AdminShell owner={owner}>{children}</AdminShell>;
}
