import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalClose } from "@/components/ui/modal";
import { StatePanel } from "@/components/ui/state-panel";

describe("design-system primitives", () => {
  it("prevents duplicate action while a button is loading", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button isLoading loadingLabel="Saving order" onClick={handleClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving order" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("associates field descriptions and errors with the control", () => {
    render(
      <Field
        id="email"
        label="Email address"
        description="Used for order updates."
        error="Enter a valid email address."
        required
      >
        {(controlProps) => <Input {...controlProps} type="email" />}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: /email address/i });
    expect(input).toHaveAccessibleDescription(
      "Used for order updates. Enter a valid email address.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("opens a named modal, closes it, and returns focus to the trigger", async () => {
    const user = userEvent.setup();

    render(
      <Modal
        title="Confirm cancellation"
        description="Review the consequence before continuing."
        trigger={<Button>Open confirmation</Button>}
        footer={
          <ModalClose asChild>
            <Button>Keep order</Button>
          </ModalClose>
        }
      >
        <p>Order SS-2048</p>
      </Modal>,
    );

    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Confirm cancellation" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Keep order" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses an assertive alert for recoverable error state", async () => {
    const handleRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <StatePanel
        tone="error"
        title="Could not load"
        description="Try again safely."
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(handleRetry).toHaveBeenCalledOnce();
  });
});
