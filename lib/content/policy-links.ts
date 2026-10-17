import { policySchema } from "@/lib/payments/schema";
import type { PolicyContent } from "@/lib/content/schema";

type PublishedPolicy = {
  version: number;
  content: PolicyContent;
};

export function publishedPolicyLinks(
  siteUrl: string,
  policies: {
    terms: PublishedPolicy | null;
    privacy: PublishedPolicy | null;
    refund: PublishedPolicy | null;
  },
) {
  const { terms, privacy, refund } = policies;
  if (!terms || !privacy || !refund) return null;
  const site = new URL(siteUrl);
  if (site.protocol !== "https:") return null;
  if (
    !terms.content.body.trim() ||
    !privacy.content.body.trim() ||
    !refund.content.body.trim()
  )
    return null;
  return policySchema.parse({
    version: `terms-${terms.version}.privacy-${privacy.version}.refund-${refund.version}`,
    termsUrl: new URL(`/policies/terms?v=${terms.version}`, site).toString(),
    privacyUrl: new URL(
      `/policies/privacy?v=${privacy.version}`,
      site,
    ).toString(),
    refundUrl: new URL(`/policies/refund?v=${refund.version}`, site).toString(),
  });
}
