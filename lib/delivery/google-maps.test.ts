// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createGoogleMapsProvider } from "./google-maps";

const address = {
  line1: "123 Test Street",
  line2: "",
  city: "Toronto",
  province: "ON" as const,
  country: "CA" as const,
  postalCode: "M5V 3L9",
};
const valid = () => ({
  result: {
    verdict: {
      addressComplete: true,
      validationGranularity: "PREMISE",
      possibleNextAction: "ACCEPT" as string | undefined,
      hasUnconfirmedComponents: false,
    },
    address: {
      postalAddress: {
        regionCode: "CA",
        administrativeArea: "ON",
        locality: "Toronto",
        postalCode: "M5V 3L9",
        addressLines: [address.line1],
      },
      addressComponents: [
        { componentType: "street_number", confirmationLevel: "CONFIRMED" },
      ],
    },
    geocode: { placeId: "test-place-id" },
  },
});

describe("Google Maps delivery adapter", () => {
  it("requests address validation, then driving distance with the minimum field mask", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(valid()))
      .mockResolvedValueOnce(
        Response.json({ routes: [{ distanceMeters: 3500 }] }),
      );
    const provider = createGoogleMapsProvider(
      "server-key-not-for-browser",
      transport,
    );
    const result = await provider.validate(address);
    expect(result).toEqual({
      address,
      placeId: "test-place-id",
      requiresConfirmation: false,
    });
    expect(await provider.distance("private origin", result.placeId)).toBe(
      3500,
    );
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toBe(
      "https://addressvalidation.googleapis.com/v1:validateAddress",
    );
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "X-Goog-Api-Key": "server-key-not-for-browser" },
    });
    expect(JSON.parse(String(options!.body))).toMatchObject({
      address: { regionCode: "CA", addressLines: [address.line1] },
    });
    expect(transport.mock.calls[1]![1]).toMatchObject({
      headers: { "X-Goog-FieldMask": "routes.distanceMeters" },
    });
    expect(JSON.parse(String(transport.mock.calls[1]![1]!.body))).toMatchObject(
      {
        origin: { address: "private origin" },
        destination: { placeId: "test-place-id" },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      },
    );
  });
  it("does not duplicate an apartment Google puts on the first line", async () => {
    const response = valid();
    response.result.verdict.validationGranularity = "SUB_PREMISE";
    response.result.address.postalAddress.addressLines = ["4-123 Test Street"];
    const provider = createGoogleMapsProvider(
      "key",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)),
    );
    expect(
      (await provider.validate({ ...address, line2: "Unit 4" })).address,
    ).toMatchObject({ line1: "4-123 Test Street", line2: "" });
  });
  it("retains a customer unit when only the building is verified", async () => {
    const provider = createGoogleMapsProvider(
      "key",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(valid())),
    );
    expect(
      (await provider.validate({ ...address, line2: "Unit 4" })).address.line2,
    ).toBe("Unit 4");
  });
  it("accepts a complete, confirmed premise-proximity address but requires customer review", async () => {
    const response = valid();
    response.result.verdict.validationGranularity = "PREMISE_PROXIMITY";
    response.result.address.postalAddress.addressLines = ["100 Queen St W"];
    response.result.address.postalAddress.postalCode = "M5H 2N1";
    response.result.address.addressComponents.push(
      { componentType: "route", confirmationLevel: "CONFIRMED" },
      { componentType: "postal_code", confirmationLevel: "CONFIRMED" },
    );
    const provider = createGoogleMapsProvider(
      "key",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)),
    );
    expect(
      await provider.validate({
        ...address,
        line1: "100 Queen Street West",
        line2: "Unit 4",
        postalCode: "M5H 2N1",
      }),
    ).toEqual({
      address: {
        ...address,
        line1: "100 Queen St W",
        line2: "Unit 4",
        postalCode: "M5H 2N1",
      },
      placeId: "test-place-id",
      requiresConfirmation: true,
    });
  });
  it.each([
    ["a fix recommendation", "FIX", false, true],
    ["no accept recommendation", undefined, false, true],
    ["an unconfirmed street number", "ACCEPT", true, true],
    ["a missing confirmed postal code", "ACCEPT", false, false],
  ])(
    "rejects premise proximity with %s",
    async (_description, action, unconfirmed, confirmedPostalCode) => {
      const response = valid();
      response.result.verdict.validationGranularity = "PREMISE_PROXIMITY";
      response.result.verdict.possibleNextAction = action;
      response.result.verdict.hasUnconfirmedComponents = unconfirmed;
      response.result.address.addressComponents.push({
        componentType: "route",
        confirmationLevel: "CONFIRMED",
      });
      if (confirmedPostalCode) {
        response.result.address.addressComponents.push({
          componentType: "postal_code",
          confirmationLevel: "CONFIRMED",
        });
      }
      await expect(
        createGoogleMapsProvider(
          "key",
          vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)),
        ).validate(address),
      ).rejects.toMatchObject({ code: "address_needs_fix", status: 422 });
    },
  );
  it.each(["ROUTE", "OTHER", "LOCALITY"])(
    "rejects incomplete granularity %s",
    async (granularity) => {
      const response = valid();
      response.result.verdict.validationGranularity = granularity;
      const provider = createGoogleMapsProvider(
        "key",
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)),
      );
      await expect(provider.validate(address)).rejects.toMatchObject({
        code: "address_needs_fix",
        status: 422,
      });
    },
  );
  it("requires review for corrected details and rejects suspicious components", async () => {
    const corrected = valid();
    corrected.result.address.postalAddress.addressLines = ["123 Test St"];
    expect(
      (
        await createGoogleMapsProvider(
          "key",
          vi.fn<typeof fetch>().mockResolvedValue(Response.json(corrected)),
        ).validate(address)
      ).requiresConfirmation,
    ).toBe(true);
    const suspicious = valid();
    suspicious.result.address.addressComponents[0]!.confirmationLevel =
      "UNCONFIRMED_AND_SUSPICIOUS";
    await expect(
      createGoogleMapsProvider(
        "key",
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(suspicious)),
      ).validate(address),
    ).rejects.toMatchObject({ code: "address_needs_fix" });
  });
  it.each([
    {},
    { routes: [] },
    { routes: [{ distanceMeters: -1 }] },
    { routes: [{ distanceMeters: 3.5 }] },
    { routes: [{ distanceMeters: "1000" }] },
  ])("fails closed for missing/invalid routing responses %#", async (body) => {
    await expect(
      createGoogleMapsProvider(
        "key",
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)),
      ).distance("private", "place"),
    ).rejects.toMatchObject({ code: "route_unavailable" });
  });
  it("does not disclose keys, addresses or upstream errors", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error("secret-key private origin recipient address"),
      );
    await expect(
      createGoogleMapsProvider("secret-key", transport).validate(address),
    ).rejects.toMatchObject({ code: "provider_unavailable", status: 503 });
    try {
      await createGoogleMapsProvider("secret-key", transport).validate(address);
    } catch (error) {
      expect(String(error)).not.toMatch(
        /secret-key|private origin|recipient address/,
      );
    }
  });
  it("makes no external request without configuration", async () => {
    const transport = vi.fn<typeof fetch>();
    await expect(
      createGoogleMapsProvider(undefined, transport).validate(address),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("handles HTTP failures and malformed JSON", async () => {
    for (const response of [
      new Response("private", { status: 403 }),
      new Response("not json", { status: 200 }),
    ])
      await expect(
        createGoogleMapsProvider(
          "key",
          vi.fn<typeof fetch>().mockResolvedValue(response),
        ).validate(address),
      ).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});
