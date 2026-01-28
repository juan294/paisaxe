import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageSkeleton } from "./skeleton-chat-message";

describe("ChatMessageSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    render(<ChatMessageSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-label='Loading' for screen readers", () => {
    render(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading");
  });

  it("renders as an assistant-style message bubble (left-aligned)", () => {
    render(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    // Assistant messages are left-aligned with bg-white/20
    expect(el.className).toContain("bg-white/20");
  });

  it("renders skeleton text lines inside the bubble", () => {
    render(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    const textLines = el.querySelectorAll(".animate-pulse");
    expect(textLines.length).toBeGreaterThanOrEqual(2);
  });

  it("has rounded corners matching chat message style", () => {
    render(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("rounded-2xl");
  });

  it("constrains width to match chat message max width", () => {
    render(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("max-w-[85%]");
  });
});
