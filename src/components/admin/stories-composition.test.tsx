import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoriesTabPanel } from "./stories-tab-panel";
import type { AdminStory } from "@/types/admin";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams("tab=stories"),
}));

const initialStory: AdminStory = {
  id: "550e8400-e29b-41d4-a716-446655440000", slug: "phase10-story",
  title: "Phase10 original", subtitle: "Synthetic subtitle", description: "Synthetic description",
  category: "nature", image: "", displayOrder: 1, curationStatus: "needs_curation",
  createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z",
};
let story: AdminStory;
let patchAttempts: Record<string, unknown>[];

beforeEach(() => {
  story = {...initialStory};
  patchAttempts = [];
  vi.clearAllMocks();
  // Replace only the network boundary: real API helpers, dynamic panels, grid,
  // card, selection checkbox, editor, fields and save handler compose together.
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname === "/api/admin/stories" && !init?.method) {
      return Response.json({data: {stories: [story], total: 1, page: 1, pageSize: 20}});
    }
    if (url.pathname === `/api/admin/stories/${story.id}` && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      patchAttempts.push(body);
      if (patchAttempts.length === 1) return Response.json({error: "Synthetic save failure"}, {status: 500});
      story = {...story, ...body};
      return Response.json({data: story});
    }
    throw new Error(`Unexpected test transport: ${init?.method ?? "GET"} ${url.pathname}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("real admin story composition", () => {
  it("keeps keyboard selection separate from editing, preserves failed drafts and retries successfully", async () => {
    const user = userEvent.setup();
    render(<StoriesTabPanel />);
    const checkbox = await screen.findByRole("checkbox", {name: "Seleccionar Phase10 original"});
    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("1 selected")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).toHaveFocus();

    await user.click(screen.getByRole("button", {name: /Phase10 original/}));
    const dialog = await screen.findByRole("dialog", {name: "Edit Story"});
    const title = within(dialog).getByLabelText(/Title/);
    title.focus();
    fireEvent.change(title, {target: {value: "Phase10 corrected"}});
    expect(within(dialog).getByLabelText(/Title/)).toBe(title);
    expect(title).toHaveFocus();
    await user.click(within(dialog).getByRole("button", {name: "Save Changes"}));
    expect(await within(dialog).findByText("Synthetic save failure")).toBeInTheDocument();
    expect(title).toHaveValue("Phase10 corrected");
    expect(within(dialog).getByLabelText(/Title/)).toBe(title);
    await user.click(within(dialog).getByRole("button", {name: "Save Changes"}));
    await waitFor(() => expect(screen.queryByRole("dialog", {name: "Edit Story"})).not.toBeInTheDocument());
    expect(patchAttempts).toHaveLength(2);
    expect(patchAttempts.map(body => body.title)).toEqual(["Phase10 corrected", "Phase10 corrected"]);
    expect(await screen.findByRole("checkbox", {name: "Seleccionar Phase10 corrected"})).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("button", {name: /Phase10 corrected/}));
    const reopened = await screen.findByRole("dialog", {name: "Edit Story"});
    expect(within(reopened).getByLabelText(/Title/)).toHaveValue("Phase10 corrected");
    fireEvent.change(within(reopened).getByLabelText(/Title/), {target: {value: "Discarded draft"}});
    await user.click(within(reopened).getByRole("button", {name: "Cancel"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", {name: /Phase10 corrected/}));
    expect(within(await screen.findByRole("dialog")).getByLabelText(/Title/)).toHaveValue("Phase10 corrected");
  });
});
