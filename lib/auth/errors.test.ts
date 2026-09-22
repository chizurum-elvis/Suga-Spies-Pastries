import { describe, expect, it } from "vitest";

import {
  isAuthRateLimitError,
  ownerSignInErrorMessage,
} from "@/lib/auth/errors";

describe("owner authentication error disclosure", () => {
  it.each([
    undefined,
    null,
    {},
    { code: "invalid_credentials", status: 400 },
    { code: "email_not_confirmed", status: 400 },
    { code: "user_not_found", status: 404 },
  ])("returns one non-enumerating sign-in response for %j", (error) => {
    expect(ownerSignInErrorMessage(error)).toBe(
      "The email or password could not be verified for owner access.",
    );
  });

  it.each([
    { code: "over_request_rate_limit" },
    { code: "over_email_send_rate_limit" },
    { status: 429 },
  ])("recognizes provider throttling without exposing internals", (error) => {
    expect(isAuthRateLimitError(error)).toBe(true);
    expect(ownerSignInErrorMessage(error)).toMatch(/wait a few minutes/i);
  });
});
