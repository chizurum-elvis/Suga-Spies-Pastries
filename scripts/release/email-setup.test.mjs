import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEmailSetup } from "../check-email-setup.mjs";

const environment = {
  ORDER_EMAIL_FROM: "orders@mail.example.com",
  RESEND_API_KEY: "fixture",
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });

test("refuses missing, display-name, and shared test senders before contacting Resend", async () => {
  for (const sender of [
    undefined,
    "",
    "Suga <orders@example.com>",
    "onboarding@resend.dev",
    "orders@demo.resend.dev",
  ]) {
    const result = await checkEmailSetup(
      { ...environment, ORDER_EMAIL_FROM: sender },
      () => {
        throw new Error("must not fetch");
      },
    );
    assert.equal(result.ready, false);
    assert.doesNotMatch(result.message, /fixture/);
  }
});
test("requires a server-side key before contacting the provider", async () => {
  const result = await checkEmailSetup({
    ORDER_EMAIL_FROM: environment.ORDER_EMAIL_FROM,
  });
  assert.equal(result.ready, false);
  assert.match(result.message, /missing/);
});
test("verifies the exact sending subdomain without sending email or following redirects", async () => {
  const result = await checkEmailSetup(environment, async (url, options) => {
    assert.equal(url.origin, "https://api.resend.com");
    assert.equal(url.pathname, "/domains");
    assert.equal(options.method, undefined);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer fixture");
    return response({
      data: [
        {
          name: "MAIL.EXAMPLE.COM",
          status: "verified",
          capabilities: { sending: "enabled" },
        },
      ],
      has_more: false,
    });
  });
  assert.equal(result.ready, true);
  assert.match(result.message, /does not prove inbox delivery/);
});
test("does not treat a verified parent or similarly named domain as the sender domain", async () => {
  const result = await checkEmailSetup(environment, async () =>
    response({
      data: [
        { name: "example.com", status: "verified" },
        { name: "mail.example.com.evil.test", status: "verified" },
      ],
    }),
  );
  assert.equal(result.ready, false);
});
test("refuses pending verification or disabled sending", async () => {
  for (const entry of [
    { status: "pending" },
    { status: "verified", capabilities: { sending: "disabled" } },
  ]) {
    const result = await checkEmailSetup(environment, async () =>
      response({ data: [{ name: "mail.example.com", ...entry }] }),
    );
    assert.equal(result.ready, false);
  }
});
test("handles pagination and bounds malformed or endless responses", async () => {
  let calls = 0;
  const result = await checkEmailSetup(environment, async (url) => {
    calls++;
    if (calls === 1)
      return response({
        data: [{ id: "cursor", name: "other.example.com" }],
        has_more: true,
      });
    assert.equal(url.searchParams.get("after"), "cursor");
    return response({
      data: [{ name: "mail.example.com", status: "verified" }],
    });
  });
  assert.equal(result.ready, true);
  calls = 0;
  assert.equal(
    (
      await checkEmailSetup(environment, async () => {
        calls++;
        return response({ data: [{ id: `cursor-${calls}` }], has_more: true });
      })
    ).ready,
    false,
  );
  assert.equal(calls, 5);
});
test("fails safely for insufficient permission, rate limits, malformed JSON, and network errors", async () => {
  for (const request of [
    async () => response({}, 403),
    async () => response({}, 429),
    async () => response({ unexpected: true }),
    async () => new Response("invalid"),
    async () => {
      throw new Error("private provider response");
    },
  ]) {
    const result = await checkEmailSetup(environment, request);
    assert.equal(result.ready, false);
    assert.doesNotMatch(result.message, /fixture|private provider response/);
  }
});
