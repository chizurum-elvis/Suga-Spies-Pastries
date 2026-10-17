import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ pathname: "/admin/content/faq" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import {
  AdminNavItems,
  adminNavigationItems,
} from "@/components/navigation/admin-nav-items";
import { AdminMobileNav } from "@/components/navigation/admin-mobile-nav";

beforeEach(() => {
  mocks.pathname = "/admin/content/faq";
});

describe("owner navigation", () => {
  it.each([false, true])(
    "keeps the website-content label visible with compact=%s",
    (compact) => {
      render(<AdminNavItems compact={compact} />);
      const link = screen.getByRole("link", { name: "Website content" });
      expect(link).toHaveAttribute("href", "/admin/content");
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link.querySelector("span")).not.toHaveClass("sr-only");
      for (const item of adminNavigationItems) {
        expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
          "href",
          item.href,
        );
      }
    },
  );

  it("does not highlight website content on an unrelated route", () => {
    mocks.pathname = "/admin/orders";
    render(<AdminNavItems />);
    expect(
      screen.getByRole("link", { name: "Website content" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each([
    "/admin/external-orders/new",
    "/admin/external-orders/98000000-0000-4000-8000-000000000001",
  ])("keeps an off-site order under Orders at %s", (pathname) => {
    mocks.pathname = pathname;
    render(<AdminNavItems />);
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page"),
    ).toHaveLength(1);
  });

  it("includes website content in the mobile menu and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <AdminMobileNav
        ownerEmail="owner@example.com"
        signOutAction={async () => {}}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Open admin navigation",
    });
    await user.click(trigger);
    const link = screen.getByRole("link", { name: "Website content" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/admin/content");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText(/not connected yet/i)).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
