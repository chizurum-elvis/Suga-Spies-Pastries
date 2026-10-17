import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame } from "@/components/customer/account-frame";
import { TokenConfirmationForm } from "@/components/customer/token-confirmation-form";
import { passwordRecoveryTokenSchema } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function CustomerEmailConfirmation({
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
      eyebrow="Email verification"
      title="One quick check."
      description="Confirm your email to keep your pastry orders together."
    >
      {token.success ? (
        <TokenConfirmationForm tokenHash={token.data} intent="signup" />
      ) : (
        <p role="alert" className="text-critical-ink text-sm">
          This link is incomplete.{" "}
          <Link href="/account/verify" className="font-bold underline">
            Request another verification link
          </Link>
          .
        </p>
      )}
    </AccountFrame>
  );
}
