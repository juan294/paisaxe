import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrivacyNotice } from "./privacy-notice";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

describe("PrivacyNotice", () => {
  it("should render notice text", () => {
    render(<PrivacyNotice onDismiss={() => {}} />);

    expect(
      screen.getByText(mockT("chat.privacy_notice"))
    ).toBeInTheDocument();
  });

  it("should render dismiss button", () => {
    render(<PrivacyNotice onDismiss={() => {}} />);

    expect(screen.getByText(mockT("chat.understood"))).toBeInTheDocument();
  });

  it("should call onDismiss when button is clicked", () => {
    const onDismiss = vi.fn();
    render(<PrivacyNotice onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText(mockT("chat.understood")));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
