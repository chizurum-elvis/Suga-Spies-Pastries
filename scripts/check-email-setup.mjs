import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Read-only provider check. Never sends mail, changes DNS, or prints credentials. */
export async function checkEmailSetup(environment, request = fetch) {
  const sender = environment.ORDER_EMAIL_FROM?.trim();
  const domain = sender
    ?.match(/^[^\s@<>]+@([a-z0-9.-]+\.[a-z]{2,})$/i)?.[1]
    ?.toLowerCase();
  if (!domain)
    return {
      ready: false,
      message:
        "Set ORDER_EMAIL_FROM to a plain business email address, without a display name.",
    };
  if (domain === "resend.dev" || domain.endsWith(".resend.dev"))
    return {
      ready: false,
      message:
        "The sender uses Resend's shared test domain. Add and verify your own sending domain first.",
    };
  if (!environment.RESEND_API_KEY)
    return {
      ready: false,
      message: "RESEND_API_KEY is missing. Keep it server-only.",
    };

  let after;
  try {
    // Bound pagination and timeouts even if the provider returns malformed data.
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://api.resend.com/domains");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      const response = await request(url, {
        headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 403)
        return {
          ready: false,
          message:
            "This key cannot inspect domains. Check verification in Resend's Domains dashboard; do not broaden a sending-only production key just for this check.",
        };
      if (!response.ok)
        return {
          ready: false,
          message: `Resend domain inspection failed (HTTP ${response.status}). No email was sent.`,
        };
      const body = await response.json();
      if (!body || !Array.isArray(body.data))
        return {
          ready: false,
          message:
            "Resend returned an unexpected domain list. Verification remains unconfirmed.",
        };
      const match = body.data.find(
        (entry) =>
          entry &&
          typeof entry.name === "string" &&
          entry.name.toLowerCase() === domain,
      );
      if (match) {
        const ready =
          match.status === "verified" &&
          match.capabilities?.sending !== "disabled";
        return {
          ready,
          message: ready
            ? "The configured sender's exact domain is verified for sending. This does not prove inbox delivery or Supabase SMTP setup; complete the inbox test next."
            : "The configured sender's domain is not verified for sending. Finish the DNS records in Resend before live checkout.",
        };
      }
      if (body.has_more !== true)
        return {
          ready: false,
          message:
            "The sender's exact domain is not in this Resend account. Add it or check that the key belongs to the correct account.",
        };
      const cursor = body.data.at(-1)?.id;
      if (typeof cursor !== "string" || !cursor || cursor === after) break;
      after = cursor;
    }
    return {
      ready: false,
      message:
        "The domain list could not be inspected completely. Check the exact sender domain in Resend's dashboard.",
    };
  } catch {
    return {
      ready: false,
      message:
        "Resend could not be checked safely. No email was sent; retry or inspect the Domains dashboard.",
    };
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const result = await checkEmailSetup(process.env);
  console.log(
    `${result.ready ? "PASS" : "ACTION REQUIRED"}: ${result.message}`,
  );
  process.exitCode = result.ready ? 0 : 1;
}
