import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageSwitcher } from "./language-switcher";

// Mock the useTranslation hook
const mockSetLocale = vi.fn();
let mockLocale = "es";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: mockSetLocale,
    t: (key: string) => key,
  }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "es";
  });

  it("should render the language switcher", () => {
    render(<LanguageSwitcher />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("should display ES and EN options", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByText("ES")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("should highlight ES when locale is es", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    const esButton = screen.getByText("ES").closest("button");
    expect(esButton?.className).toContain("text-white");
  });

  it("should call setLocale with en when EN is clicked", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByText("EN"));

    expect(mockSetLocale).toHaveBeenCalledWith("en");
  });

  it("should call setLocale with es when ES is clicked", () => {
    mockLocale = "en";
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByText("ES"));

    expect(mockSetLocale).toHaveBeenCalledWith("es");
  });

  it("should stop event propagation on click", () => {
    const parentHandler = vi.fn();
    render(
      <div onClick={parentHandler}>
        <LanguageSwitcher />
      </div>
    );

    fireEvent.click(screen.getByText("EN"));

    expect(parentHandler).not.toHaveBeenCalled();
  });

  it("should have accessible label", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      "accessibility.language_switcher"
    );
  });
});
