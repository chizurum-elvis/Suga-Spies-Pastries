// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readCheckoutJson } from "./json-request";
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://bakery.example/api/checkout/delivery", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "https://bakery.example",
      ...headers,
    },
    body,
  });
describe("bounded delivery request reader", () => {
  it("accepts same-origin JSON", async () => {
    await expect(
      readCheckoutJson(request('{"name":"Customer"}')),
    ).resolves.toEqual({ name: "Customer" });
  });
  it("rejects cross-site submissions", async () => {
    await expect(
      readCheckoutJson(request("{}", { origin: "https://evil.example" })),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires JSON and rejects malformed bodies", async () => {
    await expect(
      readCheckoutJson(request("{}", { "content-type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(readCheckoutJson(request("{"))).rejects.toMatchObject({
      code: "invalid_json",
    });
  });
  it("counts actual bytes even without Content-Length", async () => {
    await expect(
      readCheckoutJson(request(JSON.stringify({ name: "é".repeat(80) })), 128),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readCheckoutJson(request("{}", { "content-length": "1000" }), 128),
    ).rejects.toMatchObject({ status: 413 });
  });
});
