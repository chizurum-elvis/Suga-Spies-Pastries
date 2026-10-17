import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  publish: vi.fn(),
  restore: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/content/actions", () => ({
  saveSiteContent: mocks.save,
  publishSiteContent: mocks.publish,
  restoreSiteContent: mocks.restore,
}));

import { SiteContentEditor } from "@/components/admin/site-content-editor";
import { defaultFaqContent, defaultHomeContent } from "@/lib/content/defaults";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({
    status: "success",
    message: "Draft saved.",
    submissionId: "save-1",
  });
  mocks.publish.mockResolvedValue({
    status: "success",
    message: "Published.",
    submissionId: "publish-1",
  });
  mocks.restore.mockResolvedValue({
    status: "success",
    message: "Restored.",
    submissionId: "restore-1",
  });
});

describe("owner website editor", () => {
  it("can refresh an already published version without making an edit", async () => {
    const user = userEvent.setup();
    render(
      <SiteContentEditor
        contentKey="contact"
        version={1}
        initialBody={{ phone: "+1 (437) 332-7263", email: "" }}
        publishedVersion={1}
        history={[]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Refresh public pages" }),
    );
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("previews edits and requires saving before publication", async () => {
    const user = userEvent.setup();
    render(
      <SiteContentEditor
        contentKey="home"
        version={2}
        initialBody={defaultHomeContent}
        publishedVersion={1}
        history={[{ version: 1, publishedAt: "2026-10-16T10:00:00Z" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Publish version" }),
    ).toBeEnabled();
    const heading = screen.getByLabelText("Welcome heading");
    await user.clear(heading);
    await user.type(heading, "A little sweetness, delivered.");
    expect(
      screen.getByRole("heading", { name: "A little sweetness, delivered." }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Publish version" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    const submitted = mocks.save.mock.calls[0][1] as FormData;
    expect(JSON.parse(String(submitted.get("body"))).heroTitle).toBe(
      "A little sweetness, delivered.",
    );
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("lets the owner add and remove FAQs without losing existing answers", async () => {
    const user = userEvent.setup();
    render(
      <SiteContentEditor
        contentKey="faq"
        version={1}
        initialBody={defaultFaqContent}
        publishedVersion={1}
        history={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add a question" }));
    expect(screen.getAllByLabelText("Question")).toHaveLength(
      defaultFaqContent.items.length + 1,
    );
    await user.click(
      screen.getByRole("button", {
        name: `Remove question ${defaultFaqContent.items.length + 1}`,
      }),
    );
    expect(screen.getAllByLabelText("Question")).toHaveLength(
      defaultFaqContent.items.length,
    );
    expect(screen.getAllByLabelText("Answer")[0]).toHaveValue(
      defaultFaqContent.items[0].answer,
    );
  });

  it("allows an unfinished legal draft to be saved without publishing it", async () => {
    const user = userEvent.setup();
    render(
      <SiteContentEditor
        contentKey="terms"
        version={1}
        initialBody={{ title: "Terms of sale", body: "" }}
        publishedVersion={null}
        history={[]}
      />,
    );
    expect(screen.getByLabelText("Policy text")).not.toBeRequired();
    await user.type(screen.getByLabelText("Page title"), " draft");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("requires policy approval before the publication action is submitted", async () => {
    const user = userEvent.setup();
    render(
      <SiteContentEditor
        contentKey="privacy"
        version={2}
        initialBody={{
          title: "Privacy policy",
          body: "Approved text supplied by the owner.",
        }}
        publishedVersion={null}
        history={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Publish version" }));
    expect(mocks.publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publish version" }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
  });
});
