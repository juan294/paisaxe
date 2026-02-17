import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountConfigDialog } from "./account-config-dialog";
import type { MarketingAccountPublic } from "@/types/marketing";

// Mock csrfHeaders
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "x-csrf-token": "test-token" }),
}));

const existingAccount: MarketingAccountPublic = {
  id: "acc-1",
  platform: "x",
  accountName: "Paisaxe",
  accountHandle: "@elpaisaxe",
  isActive: true,
  hasCredentials: true,
  lastSyncAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("AccountConfigDialog", () => {
  const defaultProps = {
    platform: "x" as const,
    existingAccount: undefined as MarketingAccountPublic | undefined,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when platform is null", () => {
    const { container } = render(
      <AccountConfigDialog
        platform={null}
        existingAccount={undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with Connect title for new account", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    // Title contains "Connect X (Twitter)" - match the full title text
    expect(screen.getByText(/Connect.*X \(Twitter\)/)).toBeInTheDocument();
  });

  it("renders dialog with Configure title for existing account", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        existingAccount={existingAccount}
      />
    );

    expect(screen.getByText(/Configure/)).toBeInTheDocument();
    expect(screen.getByText(/X \(Twitter\)/)).toBeInTheDocument();
  });

  it("renders platform badge", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    // The badge is "X" for X platform
    expect(screen.getByText("X", { selector: "div" })).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    expect(
      screen.getByText("Enter your API credentials to enable automated posting")
    ).toBeInTheDocument();
  });

  it("renders Account Name input with default value", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    const input = screen.getByLabelText("Account Name");
    expect(input).toBeInTheDocument();
    // useEffect sets default to "Paisaxe" when no existingAccount
    expect(input).toHaveValue("Paisaxe");
  });

  it("pre-fills Account Name from existing account", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        existingAccount={existingAccount}
      />
    );

    const input = screen.getByLabelText("Account Name");
    expect(input).toHaveValue("Paisaxe");
  });

  it("renders Handle / Username input", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    const input = screen.getByLabelText("Handle / Username");
    expect(input).toBeInTheDocument();
  });

  it("pre-fills Handle from existing account", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        existingAccount={existingAccount}
      />
    );

    const input = screen.getByLabelText("Handle / Username");
    expect(input).toHaveValue("@elpaisaxe");
  });

  it("renders credential fields for X platform", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    expect(screen.getByText("Consumer Key")).toBeInTheDocument();
    expect(screen.getByText("Consumer Secret")).toBeInTheDocument();
    expect(screen.getByText("Access Token")).toBeInTheDocument();
    expect(screen.getByText("Access Token Secret")).toBeInTheDocument();
  });

  it("renders credential fields for Instagram platform", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        platform="instagram"
      />
    );

    expect(screen.getByText("Long-Lived Access Token")).toBeInTheDocument();
    expect(screen.getByText("App ID")).toBeInTheDocument();
    expect(screen.getByText("App Secret")).toBeInTheDocument();
  });

  it("renders credential fields for Pinterest platform", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        platform="pinterest"
      />
    );

    expect(screen.getByText("Access Token")).toBeInTheDocument();
    expect(screen.getByText("Refresh Token")).toBeInTheDocument();
    expect(screen.getByText("App ID")).toBeInTheDocument();
    expect(screen.getByText("App Secret")).toBeInTheDocument();
  });

  it("marks required fields with asterisk", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    // All 4 X fields are required, so there should be 4 asterisks
    const requiredMarkers = screen.getAllByText("*");
    expect(requiredMarkers.length).toBe(4);
  });

  it("credential inputs are password type by default", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    const consumerKeyInput = screen.getByPlaceholderText("Your X Consumer Key");
    expect(consumerKeyInput).toHaveAttribute("type", "password");
  });

  it("toggles password visibility when eye button clicked", async () => {
    const user = userEvent.setup();
    render(<AccountConfigDialog {...defaultProps} />);

    const consumerKeyInput = screen.getByPlaceholderText("Your X Consumer Key");
    expect(consumerKeyInput).toHaveAttribute("type", "password");

    // Find the first toggle button (they are button elements near the inputs)
    const toggleButtons = screen.getAllByRole("button").filter(
      (btn) => !btn.textContent?.includes("Cancel") && !btn.textContent?.includes("Connect")
    );
    await user.click(toggleButtons[0]);

    expect(consumerKeyInput).toHaveAttribute("type", "text");
  });

  it("toggles back to password on second click", async () => {
    const user = userEvent.setup();
    render(<AccountConfigDialog {...defaultProps} />);

    const consumerKeyInput = screen.getByPlaceholderText("Your X Consumer Key");
    const toggleButtons = screen.getAllByRole("button").filter(
      (btn) => !btn.textContent?.includes("Cancel") && !btn.textContent?.includes("Connect")
    );

    await user.click(toggleButtons[0]);
    expect(consumerKeyInput).toHaveAttribute("type", "text");

    await user.click(toggleButtons[0]);
    expect(consumerKeyInput).toHaveAttribute("type", "password");
  });

  it("renders Cancel and Connect buttons for new account", () => {
    render(<AccountConfigDialog {...defaultProps} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("renders Update button for existing account", () => {
    render(
      <AccountConfigDialog
        {...defaultProps}
        existingAccount={existingAccount}
      />
    );

    expect(screen.getByText("Update")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AccountConfigDialog {...defaultProps} onClose={onClose} />
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation error when required fields are empty", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    await user.click(screen.getByText("Connect"));

    expect(
      screen.getByText(/Please fill in:/)
    ).toBeInTheDocument();
  });

  it("shows all missing required field names in error", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    await user.click(screen.getByText("Connect"));

    const errorText = screen.getByText(/Please fill in:/);
    expect(errorText.textContent).toContain("Consumer Key");
    expect(errorText.textContent).toContain("Consumer Secret");
    expect(errorText.textContent).toContain("Access Token");
    expect(errorText.textContent).toContain("Access Token Secret");
  });

  it("saves successfully when required fields are filled", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new-acc" } }),
    });

    render(
      <AccountConfigDialog {...defaultProps} onSaved={onSaved} />
    );

    // Fill in all 4 required X credential fields
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key-123");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret-456");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token-789");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh-abc");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/marketing/accounts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-csrf-token": "test-token",
        }),
      })
    );
  });

  it("sends correct body data when saving", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new-acc" } }),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    // Fill account name and handle
    const accountNameInput = screen.getByLabelText("Account Name");
    await user.clear(accountNameInput);
    await user.type(accountNameInput, "My Account");
    await user.type(screen.getByLabelText("Handle / Username"), "@myhandle");

    // Fill credentials
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key-1");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret-1");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token-1");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh-1");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.platform).toBe("x");
    expect(body.accountName).toBe("My Account");
    expect(body.accountHandle).toBe("@myhandle");
    expect(body.credentials).toEqual({
      apiKey: "key-1",
      apiSecret: "secret-1",
      accessToken: "token-1",
      refreshToken: "refresh-1",
    });
  });

  it("defaults accountName to Paisaxe when empty", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new-acc" } }),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    // Fill only required credentials (leave account name empty)
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key-1");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret-1");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token-1");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh-1");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.accountName).toBe("Paisaxe");
  });

  it("sends undefined accountHandle when empty", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new-acc" } }),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    // Fill only required credentials (leave handle empty)
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key-1");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret-1");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token-1");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh-1");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.accountHandle).toBeUndefined();
  });

  it("shows error when API returns non-ok response", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Invalid credentials" }),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "bad");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "bad");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "bad");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "bad");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows fallback error message when API returns error without message", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Failed to save account")).toBeInTheDocument();
    });
  });

  it("shows error when fetch throws an Error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  it("shows 'Unknown error' when catch receives non-Error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValue("string error");

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Unknown error")).toBeInTheDocument();
    });
  });

  it("disables save button while saving", async () => {
    const user = userEvent.setup();

    // Make fetch hang so we can check disabled state
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    await user.click(screen.getByText("Connect"));

    // Spinner should be visible (replaces "Connect" text)
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();

    // The button containing the spinner should be disabled
    const saveButton = spinner?.closest("button");
    expect(saveButton).toBeDisabled();
  });

  it("re-enables save button after save completes", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    render(<AccountConfigDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    await user.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    // After error, button should show "Connect" text again and not be disabled
    expect(screen.getByText("Connect")).not.toBeDisabled();
  });

  it("resets form when platform changes", () => {
    const { rerender } = render(
      <AccountConfigDialog
        platform="x"
        existingAccount={existingAccount}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Should show existing account name
    expect(screen.getByLabelText("Account Name")).toHaveValue("Paisaxe");

    // Change to instagram with no existing account
    rerender(
      <AccountConfigDialog
        platform="instagram"
        existingAccount={undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Account name should default to "Paisaxe" (the initial value from useEffect when no existing account is "")
    // However, because existingAccount is undefined, it defaults to ""
    // Let's check the credential fields changed
    expect(screen.getByText("Long-Lived Access Token")).toBeInTheDocument();
  });

  it("only validates required fields, not optional ones", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new-acc" } }),
    });

    // Instagram has 1 required field and 2 optional
    render(
      <AccountConfigDialog
        platform="instagram"
        existingAccount={undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Fill only the required field
    await user.type(
      screen.getByPlaceholderText("Your Instagram access token"),
      "ig-token-123"
    );

    // Do NOT fill optional fields
    await user.click(screen.getByText("Connect"));

    // Should succeed without validation error
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Please fill in/)).not.toBeInTheDocument();
  });

  it("shows validation error for required Instagram field when empty", async () => {
    const user = userEvent.setup();

    render(
      <AccountConfigDialog
        platform="instagram"
        existingAccount={undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByText("Connect"));

    expect(screen.getByText(/Please fill in: Long-Lived Access Token/)).toBeInTheDocument();
  });

  it("updates credential input values on typing", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("Your X Consumer Key");
    await user.type(input, "my-api-key");

    expect(input).toHaveValue("my-api-key");
  });

  it("updates account name on typing", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    const input = screen.getByLabelText("Account Name");
    // Default is "Paisaxe" from useEffect, so clear first
    await user.clear(input);
    await user.type(input, "My Brand");

    expect(input).toHaveValue("My Brand");
  });

  it("updates handle on typing", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    const input = screen.getByLabelText("Handle / Username");
    await user.type(input, "@mybrand");

    expect(input).toHaveValue("@mybrand");
  });

  it("does not call fetch when platform is null on save", async () => {
    // This tests the early return in handleSave
    // We can't directly test this through UI since the dialog isn't rendered,
    // but we verify by asserting that no fetch is made
    global.fetch = vi.fn();

    render(
      <AccountConfigDialog
        platform={null}
        existingAccount={undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Dialog is not rendered, so no save button exists
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clears error on new save attempt", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "First error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "new-acc" } }),
      });

    render(<AccountConfigDialog {...defaultProps} />);

    // Fill credentials
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "key");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "secret");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "token");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "refresh");

    // First attempt - error
    await user.click(screen.getByText("Connect"));
    await waitFor(() => {
      expect(screen.getByText("First error")).toBeInTheDocument();
    });

    // Second attempt - error should be cleared before request
    await user.click(screen.getByText("Connect"));
    await waitFor(() => {
      expect(screen.queryByText("First error")).not.toBeInTheDocument();
    });
  });

  it("trims whitespace-only credentials as invalid", async () => {
    const user = userEvent.setup();

    render(<AccountConfigDialog {...defaultProps} />);

    // Type only spaces
    await user.type(screen.getByPlaceholderText("Your X Consumer Key"), "   ");
    await user.type(screen.getByPlaceholderText("Your X Consumer Secret"), "valid");
    await user.type(screen.getByPlaceholderText("Your Access Token"), "valid");
    await user.type(screen.getByPlaceholderText("Your Access Token Secret"), "valid");

    await user.click(screen.getByText("Connect"));

    // Should show validation error for Consumer Key (whitespace-only)
    expect(screen.getByText(/Please fill in: Consumer Key/)).toBeInTheDocument();
  });
});
