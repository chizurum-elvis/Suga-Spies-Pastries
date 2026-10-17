import "server-only";

import { publishedPolicyLinks } from "@/lib/content/policy-links";
import { getPublishedSiteContent } from "@/lib/content/public-data";
import { paymentConfiguration } from "@/lib/payments/configuration";

/** A complete set of owner-published policies supersedes legacy configured URLs. */
export async function resolvedPaymentConfiguration(
  environment: Parameters<typeof paymentConfiguration>[0],
) {
  const configured = paymentConfiguration(environment);
  if (!environment.NEXT_PUBLIC_SITE_URL) return configured;
  const siteContent = await getPublishedSiteContent();
  const published = publishedPolicyLinks(
    environment.NEXT_PUBLIC_SITE_URL,
    siteContent.policies,
  );
  if (!published) return configured;
  return {
    ...configured,
    policies: published,
    blockers: configured.blockers.filter(
      (message) => message !== "Checkout policies are awaiting approval.",
    ),
  };
}
