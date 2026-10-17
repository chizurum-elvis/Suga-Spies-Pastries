import type { Metadata } from "next";
import { AccountAuthForm } from "@/components/customer/account-auth-form";
import { AccountFrame } from "@/components/customer/account-frame";
import { requireCustomerIdentity } from "@/lib/customer/identity";

export const metadata: Metadata = {
  title: "Update password",
  robots: { index: false },
};
export default async function CustomerUpdatePassword() {
  await requireCustomerIdentity("/account/update-password");
  return (
    <AccountFrame
      eyebrow="Account security"
      title="Choose a new password."
      description="After the change, you’ll sign in again with the new password."
    >
      <AccountAuthForm mode="reset" configured />
    </AccountFrame>
  );
}
