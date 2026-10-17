import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  savedDetailsSchema,
  profileToDeliveryInput,
  profileValues,
} from "./profile";
import type { CustomerProfile } from "./profile";

const identity = {
  id: "98500000-0000-4000-8000-000000000001",
  email: "buyer@example.com",
};
const input = {
  name: "Pastry Buyer",
  phone: "+1 416 555 0100",
  recipientName: "Pastry Buyer",
  instructions: "Call at the door.",
  address: {
    line1: "100 Queen Street West",
    line2: "Suite 10",
    city: "Toronto",
    province: "ON",
    postalCode: "m5h2n1",
    country: "CA",
  },
};

describe("saved customer details", () => {
  it("normalizes Canadian contact information without storing an account email copy", () => {
    const parsed = savedDetailsSchema.parse(input);
    const row = profileValues(identity, parsed);
    expect(row.phone).toBe("+14165550100");
    expect(row.postal_code).toBe("M5H 2N1");
    expect(row).not.toHaveProperty("email");
    expect(row.user_id).toBe(identity.id);
    const profile = row as CustomerProfile;
    const delivery = profileToDeliveryInput(profile, identity.email);
    expect(delivery.email).toBe(identity.email);
    expect(delivery.address.postalCode).toBe("M5H 2N1");
  });

  it.each(["Ottawa", "", "Toronto<script>"])(
    "rejects a city outside the approved delivery area: %s",
    (city) => {
      expect(
        savedDetailsSchema.safeParse({
          ...input,
          address: { ...input.address, city },
        }).success,
      ).toBe(false);
    },
  );

  it("rejects foreign numbers, unsupported provinces, and bad postal codes", () => {
    expect(
      savedDetailsSchema.safeParse({ ...input, phone: "+44 20 7946 0958" })
        .success,
    ).toBe(false);
    expect(
      savedDetailsSchema.safeParse({
        ...input,
        address: { ...input.address, province: "BC" },
      }).success,
    ).toBe(false);
    expect(
      savedDetailsSchema.safeParse({
        ...input,
        address: { ...input.address, postalCode: "12345" },
      }).success,
    ).toBe(false);
  });
});
