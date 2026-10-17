import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintButton } from "@/components/admin/print-button";

it("opens the browser print dialog with a keyboard-accessible action", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<PrintButton label="Print kitchen plan" />);
  const button = screen.getByRole("button", { name: "Print kitchen plan" });
  button.focus();
  await userEvent.setup().keyboard("{Enter}");
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});
