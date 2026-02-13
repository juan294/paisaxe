import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCard } from "./account-card";

describe("AccountCard", () => {
  it("shows not connected state when no account", () => {
    render(
      <AccountCard
        platform="x"
        account={undefined}
        onConfigure={vi.fn()}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("Click to connect")).toBeInTheDocument();
    expect(screen.getByText("Not Connected")).toBeInTheDocument();
  });

  it("shows active state", () => {
    render(
      <AccountCard
        platform="x"
        account={{
          id: "acc-1",
          platform: "x",
          accountName: "Paisaxe",
          isActive: true,
          hasCredentials: true,
          accountHandle: "@elpaisaxe",
          lastSyncAt: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }}
        onConfigure={vi.fn()}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("@elpaisaxe")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });

  it("shows paused state", () => {
    render(
      <AccountCard
        platform="instagram"
        account={{
          id: "acc-2",
          platform: "instagram",
          accountName: "Paisaxe IG",
          isActive: false,
          hasCredentials: true,
          accountHandle: "@paisaxe",
          lastSyncAt: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }}
        onConfigure={vi.fn()}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("calls onConfigure when not connected card clicked", async () => {
    const user = userEvent.setup();
    const onConfigure = vi.fn();

    render(
      <AccountCard
        platform="pinterest"
        account={undefined}
        onConfigure={onConfigure}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    await user.click(screen.getByText("Pinterest"));
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle when pause button clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AccountCard
        platform="x"
        account={{
          id: "acc-3",
          platform: "x",
          accountName: "Test",
          isActive: true,
          hasCredentials: true,
          accountHandle: "@test",
          lastSyncAt: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }}
        onConfigure={vi.fn()}
        onToggle={onToggle}
        onDisconnect={vi.fn()}
      />
    );

    await user.click(screen.getByText("Pause"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows correct platform badges", () => {
    const { rerender } = render(
      <AccountCard
        platform="x"
        account={undefined}
        onConfigure={vi.fn()}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("X", { selector: "div" })).toBeInTheDocument();

    rerender(
      <AccountCard
        platform="instagram"
        account={undefined}
        onConfigure={vi.fn()}
        onToggle={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("IG")).toBeInTheDocument();
  });
});
