import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame } from "@/components/customer/account-frame";
import { TokenConfirmationForm } from "@/components/customer/token-confirmation-form";
import { passwordRecoveryTokenSchema } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Confirm password recovery",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function CustomerRecoveryConfirmation({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const params = await searchParams;
  const token = passwordRecoveryTokenSchema.shape.tokenHash.safeParse(
    params.token_hash,
  );
  return (
    <AccountFrame
      eyebrow="Account security"
      title="Use your recovery link."
      description="Only continue if you asked to reset your password."
    >
      {token.success ? (
        <TokenConfirmationForm tokenHash={token.data} intent="recovery" />
      ) : (
        <p role="alert" className="text-critical-ink text-sm">
          This link is incomplete.{" "}
          <Link href="/account/forgot-password" className="font-bold underline">
            Request another recovery link
          </Link>
          .
        </p>
      )}
    </AccountFrame>
  );
}
