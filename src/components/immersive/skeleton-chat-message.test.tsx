import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { ChatMessageSkeleton } from "./skeleton-chat-message";

function renderWithI18n(ui: React.ReactElement, locale: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLocale={locale}>{ui}</LanguageProvider>
  );
}

describe("ChatMessageSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    renderWithI18n(<ChatMessageSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses i18n translated loading label for screen readers", () => {
    renderWithI18n(<ChatMessageSkeleton />, "es");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Cargando...");
  });

  it("renders English loading label when locale is en", () => {
    renderWithI18n(<ChatMessageSkeleton />, "en");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading...");
  });

  it("renders as an assistant-style message bubble (left-aligned)", () => {
    renderWithI18n(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    // Assistant messages are left-aligned with bg-white/20
    expect(el.className).toContain("bg-white/20");
  });

  it("renders skeleton text lines inside the bubble", () => {
    renderWithI18n(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    const textLines = el.querySelectorAll(".animate-pulse");
    expect(textLines.length).toBeGreaterThanOrEqual(2);
  });

  it("has rounded corners matching chat message style", () => {
    renderWithI18n(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("rounded-2xl");
  });

  it("constrains width to match chat message max width", () => {
    renderWithI18n(<ChatMessageSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("max-w-[85%]");
  });
});
