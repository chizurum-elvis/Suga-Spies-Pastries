import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  walletHandlers: {} as Record<string, (event: unknown) => void>,
  cardHandlers: {} as Record<string, (event: unknown) => void>,
  router: { replace: vi.fn() },
  confirm: vi.fn(),
  destroy: vi.fn(),
  cardOptions: vi.fn(),
  processing: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@stripe/stripe-js/pure", () => ({
  loadStripe: vi.fn(async () => ({
    initCheckoutElementsSdk: () => ({
      loadActions: async () => ({
        type: "success",
        actions: { confirm: mocks.confirm },
      }),
      createPaymentElement: (options: unknown) => {
        mocks.cardOptions(options);
        return {
          on: (event: string, handler: (payload: unknown) => void) => {
            mocks.cardHandlers[event] = handler;
          },
          mount: vi.fn(),
          destroy: mocks.destroy,
        };
      },
      createExpressCheckoutElement: () => ({
        on: (event: string, handler: (payload: unknown) => void) => {
          mocks.walletHandlers[event] = handler;
        },
        mount: vi.fn(),
        destroy: mocks.destroy,
      }),
    }),
  })),
}));
import { PaymentMethods } from "@/components/checkout/payment-methods";

async function setup(expiresAt = new Date(Date.now() + 900_000).toISOString()) {
  const view = render(
    <PaymentMethods
      clientSecret="cs_test_secret_fixture"
      expiresAt={expiresAt}
      totalCents={1500}
      onProcessingChange={mocks.processing}
    />,
  );
  await waitFor(() => expect(mocks.cardHandlers.ready).toBeTypeOf("function"));
  act(() => mocks.cardHandlers.ready!({}));
  return view;
}

describe("secure card and wallet payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.walletHandlers = {};
    mocks.cardHandlers = {};
    mocks.confirm.mockResolvedValue({ type: "success" });
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_fixture";
  });

  it("keeps card payment available when neither wallet is supported", async () => {
    await setup();
    act(() =>
      mocks.walletHandlers.ready!({ availablePaymentMethods: undefined }),
    );
    expect(
      screen.getByRole("button", { name: "Pay $15.00 CAD" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: "Express payment" }),
    ).not.toBeInTheDocument();
    expect(mocks.cardOptions).toHaveBeenCalledWith({
      layout: "tabs",
      wallets: { applePay: "never", googlePay: "never", link: "never" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pay $15.00 CAD" }));
    await waitFor(() =>
      expect(mocks.confirm).toHaveBeenCalledWith({ redirect: "if_required" }),
    );
    expect(mocks.router.replace).toHaveBeenCalledWith("/checkout/confirmation");
  });

  it("shows eligible wallets alongside cards and confirms the provider event", async () => {
    await setup();
    act(() =>
      mocks.walletHandlers.ready!({
        availablePaymentMethods: { applePay: true, googlePay: true },
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Express payment" }),
    ).toBeVisible();
    const event = { paymentFailed: vi.fn() };
    await act(async () => mocks.walletHandlers.confirm!(event));
    expect(mocks.confirm).toHaveBeenCalledWith({
      redirect: "if_required",
      expressCheckoutConfirmEvent: event,
    });
  });

  it("a wallet loading failure does not block card entry", async () => {
    await setup();
    act(() => mocks.walletHandlers.loaderror!({}));
    expect(
      screen.getByRole("button", { name: "Pay $15.00 CAD" }),
    ).toBeEnabled();
  });

  it("shows a bank decline without claiming payment succeeded", async () => {
    mocks.confirm.mockResolvedValue({
      type: "error",
      error: { message: "Your card was declined." },
    });
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Pay $15.00 CAD" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your card was declined.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Pay $15.00 CAD" }),
    ).toBeEnabled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.processing).toHaveBeenLastCalledWith(false);
  });

  it("blocks repeated submissions and wallet/card races while confirmation is pending", async () => {
    mocks.confirm.mockReturnValue(new Promise(() => {}));
    const { container } = await setup();
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.submit(container.querySelector("form")!);
    act(() => mocks.walletHandlers.confirm!({ paymentFailed: vi.fn() }));
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Confirming payment…" }),
    ).toBeDisabled();
  });

  it("does not retry an uncertain network result or claim success", async () => {
    mocks.confirm.mockRejectedValue(new Error("network lost"));
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Pay $15.00 CAD" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Check payment status",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Pay $15.00 CAD" }),
    ).toBeDisabled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("rejects submissions after the capacity deadline", async () => {
    await setup(new Date(Date.now() - 1000).toISOString());
    fireEvent.click(screen.getByRole("button", { name: "Pay $15.00 CAD" }));
    expect(screen.getByRole("alert")).toHaveTextContent("payment window ended");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("handles cancellation of a wallet without losing the card fallback", async () => {
    await setup();
    act(() => mocks.walletHandlers.cancel!({}));
    expect(screen.getByRole("alert")).toHaveTextContent("pay by card");
    expect(
      screen.getByRole("button", { name: "Pay $15.00 CAD" }),
    ).toBeEnabled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("cleans up both secure elements on unmount", async () => {
    const view = await setup();
    view.unmount();
    expect(mocks.destroy).toHaveBeenCalledTimes(2);
  });
});
