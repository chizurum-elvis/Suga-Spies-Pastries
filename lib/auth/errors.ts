type AuthErrorLike = {
  code?: string;
  status?: number;
};

const rateLimitCodes = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
  "request_timeout",
]);

export function isAuthRateLimitError(error: AuthErrorLike | null | undefined) {
  return Boolean(
    error &&
    (error.status === 429 || (error.code && rateLimitCodes.has(error.code))),
  );
}

export function ownerSignInErrorMessage(
  error: AuthErrorLike | null | undefined,
) {
  return isAuthRateLimitError(error)
    ? "Too many sign-in attempts. Wait a few minutes before trying again."
    : "The email or password could not be verified for owner access.";
}
