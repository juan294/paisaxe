import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketingDashboard } from "./marketing-dashboard";

// Mock child components - AccountCard passes through callbacks for testing
vi.mock("./account-card", () => ({
  AccountCard: ({ platform, onConfigure, onToggle, onDisconnect }: {
    platform: string;
    onConfigure: () => void;
    onToggle: () => void;
    onDisconnect: () => void;
  }) => (
    <div data-testid={`account-card-${platform}`}>
      {platform}
      <button data-testid={`configure-${platform}`} onClick={onConfigure}>Configure</button>
      <button data-testid={`toggle-${platform}`} onClick={onToggle}>Toggle</button>
      <button data-testid={`disconnect-${platform}`} onClick={onDisconnect}>Disconnect</button>
    </div>
  ),
}));
vi.mock("./account-config-dialog", () => ({
  AccountConfigDialog: ({ platform, onClose, onSaved }: { platform: string | null; onClose: () => void; onSaved: () => void }) => (
    platform ? (
      <div data-testid="config-dialog">
        {platform}
        <button data-testid="config-close" onClick={onClose}>Close Config</button>
        <button data-testid="config-save" onClick={onSaved}>Save Config</button>
      </div>
    ) : null
  ),
}));
vi.mock("./post-row", () => ({
  PostRow: ({ post }: { post: { content: string } }) => (
    <tr data-testid="post-row"><td>{post.content}</td></tr>
  ),
}));
vi.mock("./stat-card", () => ({
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid={`stat-${label}`}>{value}</div>
  ),
}));
vi.mock("./drafts-panel", () => ({
  DraftsPanel: () => <div data-testid="drafts-panel">Drafts</div>,
}));
vi.mock("../voice-agent-chat", () => ({
  VoiceAgentChat: () => <div data-testid="voice-agent-chat">Voice Chat</div>,
}));

// Mock csrfHeaders
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "x-csrf-token": "test-token" }),
}));

const mockData = {
  accounts: [
    { platform: "x", isActive: true, hasCredentials: true, accountHandle: "@elpaisaxe" },
  ],
  stats: {
    totalPosts: 10,
    postsThisWeek: 3,
    postsThisMonth: 8,
    failedPosts: 0,
    totalEngagement: { likes: 0, comments: 0, shares: 0 },
    byPlatform: {},
  },
  recentPosts: [],
  upcomingPosts: [],
  schedules: [],
};

describe("MarketingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<MarketingDashboard />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders header after data loads", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Marketing Automation")).toBeInTheDocument();
    });
  });

  it("renders account cards", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("account-card-x")).toBeInTheDocument();
    });
  });

  it("renders stat cards", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("stat-Total Posts")).toBeInTheDocument();
    });

    expect(screen.getByTestId("stat-This Week")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to fetch marketing data" }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch marketing data")).toBeInTheDocument();
    });
  });

  it("renders voice chat section", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("voice-agent-chat")).toBeInTheDocument();
    });
  });

  it("renders drafts panel", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("drafts-panel")).toBeInTheDocument();
    });
  });

  it("renders upcoming posts table when posts exist", async () => {
    const dataWithPosts = {
      ...mockData,
      upcomingPosts: [
        { id: "p1", content: "Upcoming content", platform: "x", status: "scheduled" },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: dataWithPosts }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Upcoming content")).toBeInTheDocument();
    });
  });

  it("shows 'No scheduled posts' when empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No scheduled posts")).toBeInTheDocument();
    });
  });

  it("renders recent posts table when posts exist", async () => {
    const dataWithPosts = {
      ...mockData,
      recentPosts: [
        { id: "p2", content: "Recent content", platform: "x", status: "posted" },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: dataWithPosts }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent content")).toBeInTheDocument();
    });
  });

  it("shows 'No posts yet' when recent posts empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No posts yet")).toBeInTheDocument();
    });
  });

  it("renders schedules when active schedules exist", async () => {
    const dataWithSchedules = {
      ...mockData,
      schedules: [
        { id: "s1", platform: "x", dayOfWeek: 1, timeUtc: "10:00", isActive: true },
        { id: "s2", platform: "instagram", dayOfWeek: null, timeUtc: "15:00", isActive: true },
        { id: "s3", platform: "x", dayOfWeek: 3, timeUtc: "09:00", isActive: false },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: dataWithSchedules }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    // Daily schedule (dayOfWeek null)
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();

    // Inactive schedule should not render
    expect(screen.queryByText("09:00")).not.toBeInTheDocument();
  });

  it("shows 'No schedules configured' when empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No schedules configured")).toBeInTheDocument();
    });
  });

  it("shows setup instructions when no accounts connected", async () => {
    const dataNoAccounts = { ...mockData, accounts: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: dataNoAccounts }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No accounts connected")).toBeInTheDocument();
    });
  });

  it("shows Retry button on error state", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    expect(screen.getByText("Retry")).toBeInTheDocument();

    await user.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Marketing Automation")).toBeInTheDocument();
    });
  });

  it("handles network error in loadData", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("pauses active account on toggle", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // PATCH pause
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }); // reload
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("action=pause"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("opens configure dialog for platform without credentials", async () => {
    const user = userEvent.setup();
    // instagram has no account
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("configure-instagram")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("configure-instagram"));

    await waitFor(() => {
      expect(screen.getByTestId("config-dialog")).toBeInTheDocument();
    });
  });

  it("disconnects account after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }); // reload
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("disconnect-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("disconnect-x"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("platform=x"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("does not disconnect when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("disconnect-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("disconnect-x"));

    // Only the initial load should have been called
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles disconnect account error when response is not ok", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }) // initial load
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Disconnect failed" }),
      }); // DELETE fails
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("disconnect-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("disconnect-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Disconnect account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Disconnect failed"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles toggle account error when pause response is not ok", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }) // initial load
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Pause failed" }),
      }); // PATCH pause fails
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    // X account is active with credentials, so toggling should try to pause
    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Toggle account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Pause failed"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("resumes inactive account with credentials on toggle", async () => {
    const user = userEvent.setup();
    const dataWithInactiveAccount = {
      ...mockData,
      accounts: [
        { platform: "x", isActive: false, hasCredentials: true, accountHandle: "@elpaisaxe" },
      ],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: dataWithInactiveAccount }) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // PATCH resume
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }); // reload
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("action=resume"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("opens configure dialog when toggling account without credentials", async () => {
    const user = userEvent.setup();
    const dataWithNoCredentials = {
      ...mockData,
      accounts: [
        { platform: "x", isActive: false, hasCredentials: false, accountHandle: null },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: dataWithNoCredentials }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    // Should open config dialog instead of making API call
    await waitFor(() => {
      expect(screen.getByTestId("config-dialog")).toBeInTheDocument();
    });

    // Only the initial fetch should have been called (no PATCH/reload)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("closes config dialog via onClose callback", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("configure-instagram")).toBeInTheDocument();
    });

    // Open config dialog
    await user.click(screen.getByTestId("configure-instagram"));

    await waitFor(() => {
      expect(screen.getByTestId("config-dialog")).toBeInTheDocument();
    });

    // Close config dialog (line 323: onClose={() => setConfiguringPlatform(null)))
    await user.click(screen.getByTestId("config-close"));

    await waitFor(() => {
      expect(screen.queryByTestId("config-dialog")).not.toBeInTheDocument();
    });
  });

  it("handleAccountSaved closes dialog and reloads data", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) }); // reload after save
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("configure-instagram")).toBeInTheDocument();
    });

    // Open config dialog
    await user.click(screen.getByTestId("configure-instagram"));

    await waitFor(() => {
      expect(screen.getByTestId("config-dialog")).toBeInTheDocument();
    });

    // Save config (triggers handleAccountSaved: setConfiguringPlatform(null) + loadData())
    await user.click(screen.getByTestId("config-save"));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId("config-dialog")).not.toBeInTheDocument();
    });

    // loadData should have been called again
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles resume account error when response is not ok", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const dataWithInactiveAccount = {
      ...mockData,
      accounts: [
        { platform: "x", isActive: false, hasCredentials: true, accountHandle: "@elpaisaxe" },
      ],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: dataWithInactiveAccount }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Resume failed" }),
      });
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Toggle account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Resume failed"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("returns null when API responds ok but data is null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });

    const { container } = render(<MarketingDashboard />);

    // Wait for loading to finish (spinner disappears)
    await waitFor(() => {
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    // No error is shown (error state is empty)
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();

    // No dashboard content is rendered (line 133: if (!data) return null)
    expect(screen.queryByText("Marketing Automation")).not.toBeInTheDocument();

    // Container should be empty since component returns null
    expect(container.innerHTML).toBe("");
  });

  it("shows Refresh button and refreshes on click", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Refresh"));

    // Should have been called twice: initial + refresh
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("handles non-Error thrown in loadData (line 43 else branch)", async () => {
    // When the thrown value is not an Error instance, the message should be "Unknown error"
    global.fetch = vi.fn().mockRejectedValue("string error");

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Unknown error")).toBeInTheDocument();
    });
  });

  it("uses fallback error message when API error response has no error field (line 38/68)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}), // no "error" field
    });

    render(<MarketingDashboard />);

    // result.error is undefined, so fallback "Failed to fetch marketing data" should appear
    await waitFor(() => {
      expect(screen.getByText("Failed to fetch marketing data")).toBeInTheDocument();
    });
  });

  it("uses fallback error message when pause response has no error field (line 68)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}), // no error field
      });
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Toggle account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Failed to pause account"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("uses fallback error message when resume response has no error field (line 78)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const dataWithInactiveAccount = {
      ...mockData,
      accounts: [
        { platform: "x", isActive: false, hasCredentials: true, accountHandle: "@elpaisaxe" },
      ],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: dataWithInactiveAccount }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}), // no error field
      });
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Toggle account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Failed to resume account"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles toggle for platform with no account (line 169 ?? false fallback)", async () => {
    const user = userEvent.setup();
    // mockData has an x account but no instagram/pinterest account
    // Toggling instagram should trigger handleToggleAccount with isActive=false, hasCredentials=false
    // which should open the configure dialog (the "no credentials" branch)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-instagram")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-instagram"));

    // account is undefined for instagram, so account?.isActive ?? false = false
    // and account?.hasCredentials ?? false = false
    // This triggers the "else" branch in handleToggleAccount which opens config dialog
    await waitFor(() => {
      expect(screen.getByTestId("config-dialog")).toBeInTheDocument();
    });

    // Only the initial fetch should have been called (no PATCH)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses fallback error message when disconnect response has no error field (line 102)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockData }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}), // no error field
      });
    global.fetch = fetchMock;

    render(<MarketingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("disconnect-x")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("disconnect-x"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Disconnect account error")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Failed to disconnect account"')
      );
    });

    consoleSpy.mockRestore();
  });
});
