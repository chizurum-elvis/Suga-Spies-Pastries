import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ProductForm } from "@/components/admin/product-form";

it("suggests a readable address, preserves a manual choice, and defaults to four pastries", async () => {
  const user = userEvent.setup();
  render(<ProductForm categories={[]} action={async (state) => state} />);
  const name = screen.getByRole("textbox", { name: /Pastry name/ });
  const address = screen.getByRole("textbox", { name: /Website page address/ });
  await user.type(name, "Maple Cookies");
  expect(address).toHaveValue("maple-cookies");
  await user.clear(address);
  await user.type(address, "special-maple-cookies");
  await user.type(name, " Large");
  expect(address).toHaveValue("special-maple-cookies");
  expect(
    screen.getByRole("spinbutton", { name: /Minimum quantity/ }),
  ).toHaveValue(4);
  expect(
    screen.getByRole("spinbutton", { name: /Quantity increment/ }),
  ).toHaveValue(1);
});
