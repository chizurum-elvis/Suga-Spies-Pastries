import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { RecoveryConfirmationForm } from "@/components/auth/recovery-confirmation-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import type { AuthActionState } from "@/lib/auth/action-state";

const idleAction = async (): Promise<AuthActionState> => ({ status: "idle" });

describe("owner authentication forms", () => {
  it("fails closed and disables owner credentials when Supabase is missing", () => {
    render(
      <SignInForm
        action={idleAction}
        configured={false}
        returnTo="/admin"
        pageMessage={{
          status: "error",
          message: "Owner sign-in is unavailable until configuration is added.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /sign-in is unavailable/i,
    );
    expect(
      screen.getByRole("textbox", { name: /owner email/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText(/^password/i)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /enter owner workspace/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: /sign up/i }),
    ).not.toBeInTheDocument();
  });

  it("submits only the entered credentials and clears the password after failure", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (_state: AuthActionState, formData: FormData) => ({
        status: "error" as const,
        message: "The email or password could not be verified.",
        values: { email: String(formData.get("email")) },
        submissionId: "failed-attempt-1",
      }),
    );

    render(
      <SignInForm
        action={action}
        configured
        returnTo="/admin/orders?status=new"
      />,
    );

    const email = screen.getByRole("textbox", { name: /owner email/i });
    const password = screen.getByLabelText(/^password/i);
    await user.type(email, "Owner@Example.com");
    await user.type(password, "NeverStoreThisPassword1!");
    await user.click(
      screen.getByRole("button", { name: /enter owner workspace/i }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be verified/i,
    );
    await waitFor(() => expect(password).toHaveValue(""));

    const submittedForm = action.mock.calls[0]?.[1];
    expect(submittedForm?.get("returnTo")).toBe("/admin/orders?status=new");
    expect(submittedForm?.get("password")).toBe("NeverStoreThisPassword1!");
  });

  it("focuses a new error message for assistive-technology users", async () => {
    render(
      <AuthFormMessage
        state={{
          status: "error",
          message: "Check the highlighted fields.",
          submissionId: "validation-error-1",
        }}
      />,
    );

    const alert = screen.getByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("keeps password recovery non-enumerating and password-manager friendly", () => {
    const { unmount } = render(
      <PasswordRecoveryForm
        action={idleAction}
        configured
        pageMessage={{
          status: "success",
          message:
            "If that address belongs to the owner account, a secure recovery link is on its way.",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /if that address belongs/i,
    );
    unmount();

    render(<UpdatePasswordForm action={idleAction} />);
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("requires an intentional submit before consuming an emailed token", () => {
    render(
      <RecoveryConfirmationForm
        action={idleAction}
        tokenHash="email-token_hash-0123456789"
      />,
    );

    expect(
      screen.getByText(/prevents email preview tools from using/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /continue securely/i }),
    ).toBeEnabled();
    expect(document.querySelector('input[name="tokenHash"]')).toHaveValue(
      "email-token_hash-0123456789",
    );
  });
});
