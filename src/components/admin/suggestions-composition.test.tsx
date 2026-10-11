import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionsPanel } from "./suggestions-panel";
import type { AdminStorySuggestion } from "@/types/suggestions";
import type { CreateStoryRequest } from "@/types/admin";

const suggestions: AdminStorySuggestion[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    placeName: "Phase10 hidden beach",
    comment: "A visitor description to preserve",
    location: null,
    status: "pending",
    adminNotes: null,
    convertedStoryId: null,
    attribution: "@phase10-visitor",
    userId: null,
    userEmail: null,
    createdAt: "2026-10-11T00:00:00Z",
    updatedAt: "2026-10-11T00:00:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    placeName: "Phase10 separate suggestion",
    comment: null,
    location: null,
    status: "pending",
    adminNotes: "Other row notes",
    convertedStoryId: null,
    attribution: null,
    userId: null,
    userEmail: null,
    createdAt: "2026-10-11T00:00:00Z",
    updatedAt: "2026-10-11T00:00:00Z",
  },
];

let noteBodies: { adminNotes: string }[];
let storyBodies: CreateStoryRequest[];
let listReads: number;
let unexpectedRequests: string[];
let heldNotes: Promise<Response> | undefined;

beforeEach(() => {
  noteBodies = [];
  storyBodies = [];
  listReads = 0;
  unexpectedRequests = [];
  heldNotes = undefined;

  // Radix's real select measures DOM elements with this browser API. jsdom
  // has no layout; this platform seam supplies no selection or form behavior.
  vi.stubGlobal("ResizeObserver", class implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  // No owned components, hooks, API helpers, dialogs or select controls are
  // mocked. Every request is intercepted here; unexpected targets fail closed.
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.origin !== window.location.origin) {
      unexpectedRequests.push(`${method} ${url.origin}${url.pathname}`);
      throw new Error("Composition transport must remain same-origin");
    }
    if (url.pathname === "/api/admin/suggestions" && method === "GET") {
      listReads += 1;
      return Response.json({ data: suggestions.map(suggestion => ({ ...suggestion })) });
    }
    if (url.pathname === `/api/admin/suggestions/${suggestions[0].id}` && method === "PUT") {
      const body: { adminNotes: string } = JSON.parse(String(init?.body));
      noteBodies.push(body);
      if (noteBodies.length === 1 && heldNotes) return heldNotes;
      return Response.json({ data: { ...suggestions[0], ...body } });
    }
    if (url.pathname === "/api/admin/stories" && method === "POST") {
      const body: CreateStoryRequest = JSON.parse(String(init?.body));
      storyBodies.push(body);
      if (storyBodies.length === 1) {
        return Response.json({ error: "Synthetic conversion failure" }, { status: 500 });
      }
      // The server response contains only a story. The real onCreated callback
      // must update the correct suggestion locally without a replacement GET.
      return Response.json({ data: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        slug: body.slug,
        title: body.title,
        category: body.category,
        displayOrder: 1,
        curationStatus: "needs_curation",
        createdAt: "2026-10-11T00:00:00Z",
      } }, { status: 201 });
    }
    unexpectedRequests.push(`${method} ${url.pathname}`);
    throw new Error(`Unexpected composition transport: ${method} ${url.pathname}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("real suggestions and create-dialog composition", () => {
  it("retains the notes node, focus and draft through a failed save, then retries the same row", async () => {
    const user = userEvent.setup();
    let finishNotes!: (response: Response) => void;
    heldNotes = new Promise(resolve => { finishNotes = resolve; });
    const view = render(<SuggestionsPanel />);
    try {
      await screen.findByRole("heading", { name: suggestions[0].placeName });
      await user.click(screen.getAllByRole("button", { name: "Expand" })[0]);
      const notes = screen.getByRole("textbox", { name: "Admin Notes" });
      await user.type(notes, "Retained review draft");
      await user.click(screen.getByRole("button", { name: "Save Notes" }));
      expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
      expect(noteBodies).toEqual([{ adminNotes: "Retained review draft" }]);

      // A user can return to their editable notes while the request is held.
      // Resolving the failure must not remount or steal focus from that field.
      await user.click(notes);
      expect(notes).toHaveFocus();
      await act(async () => {
        finishNotes(Response.json({ error: "Synthetic notes failure" }, { status: 500 }));
      });
      expect(await screen.findByText("Synthetic notes failure")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Admin Notes" })).toBe(notes);
      expect(notes).toHaveFocus();
      expect(notes).toHaveValue("Retained review draft");

      await user.type(notes, " corrected");
      expect(notes).toHaveFocus();
      await user.click(screen.getByRole("button", { name: "Save Notes" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Save Notes" })).toBeEnabled());
      expect(noteBodies).toEqual([
        { adminNotes: "Retained review draft" },
        { adminNotes: "Retained review draft corrected" },
      ]);
      expect(screen.getByRole("textbox", { name: "Admin Notes" })).toBe(notes);
      expect(notes).toHaveValue("Retained review draft corrected");
      expect(screen.getByRole("heading", { name: suggestions[1].placeName })).toBeInTheDocument();
      expect(listReads).toBe(1);
      expect(storyBodies).toEqual([]);
      expect(unexpectedRequests).toEqual([]);
    } finally {
      view.unmount();
      finishNotes(Response.json({ error: "Fixture released" }, { status: 500 }));
    }
  });

  it("cancels and resets the real conversion dialog, preserves a failed creation and publishes only the converted row", async () => {
    const user = userEvent.setup();
    render(<SuggestionsPanel />);
    await screen.findByRole("heading", { name: suggestions[0].placeName });
    await user.click(screen.getAllByRole("button", { name: "Expand" })[0]);
    await user.click(screen.getByRole("button", { name: "Convert to Story" }));
    let dialog = await screen.findByRole("dialog", { name: "Convert Suggestion to Story" });
    const discardedTitle = within(dialog).getByRole("textbox", { name: /Title/ });
    expect(discardedTitle).toHaveValue(suggestions[0].placeName);
    expect(within(dialog).getByRole("textbox", { name: "Description" })).toHaveValue(suggestions[0].comment);
    expect(within(dialog).getByText("@phase10-visitor")).toBeInTheDocument();
    await user.clear(discardedTitle);
    await user.type(discardedTitle, "Discarded conversion draft");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(storyBodies).toEqual([]);
    expect(screen.queryByText("Converted", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Convert to Story" }));
    dialog = await screen.findByRole("dialog", { name: "Convert Suggestion to Story" });
    const title = within(dialog).getByRole("textbox", { name: /Title/ });
    expect(title).toHaveValue(suggestions[0].placeName);
    await user.clear(title);
    await user.type(title, "Verified conversion draft");
    const category = within(dialog).getByRole("combobox", { name: /Category/ });
    category.focus();
    await user.keyboard("{ArrowDown}");
    const nature = await screen.findByRole("option", { name: "Nature" });
    await waitFor(() => expect(nature).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(category).toHaveTextContent("Nature");

    await user.click(within(dialog).getByRole("button", { name: "Create Story" }));
    expect(await within(dialog).findByText("Synthetic conversion failure")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Convert Suggestion to Story" })).toBe(dialog);
    expect(within(dialog).getByRole("textbox", { name: /Title/ })).toBe(title);
    expect(title).toHaveValue("Verified conversion draft");
    expect(category).toHaveTextContent("Nature");
    expect(screen.queryByText("Converted", { exact: true })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Create Story" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(storyBodies).toHaveLength(2);
    for (const body of storyBodies) {
      expect(body).toMatchObject({
        title: "Verified conversion draft",
        slug: "verified-conversion-draft",
        category: "nature",
        description: suggestions[0].comment,
        sourceType: "user_submitted",
        suggestionId: suggestions[0].id,
      });
    }
    expect(await screen.findByText("Converted", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Converted (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Story" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: suggestions[1].placeName })).toBeInTheDocument();
    expect(listReads).toBe(1);
    expect(noteBodies).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
  });
});
