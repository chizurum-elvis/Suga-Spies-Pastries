import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { updateOwnerPassword } from "@/lib/auth/actions";
import { requireOwnerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new owner password",
};

export default async function UpdateOwnerPasswordPage() {
  await requireOwnerSession("/admin/update-password");

  return (
    <AuthShell
      eyebrow="Verified recovery session"
      title="Choose a new owner password."
      description="Use a unique passphrase that is not shared with social media, email, banking, or any other business account."
    >
      <UpdatePasswordForm action={updateOwnerPassword} />
    </AuthShell>
  );
}
