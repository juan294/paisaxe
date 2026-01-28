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

  it("should render all 5 language buttons", () => {
    render(<LanguageSwitcher />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
  });

  it("should display ES, EN, FR, DE, and PT options", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByText("ES")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("FR")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("PT")).toBeInTheDocument();
  });

  it("should highlight ES when locale is es", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    const esButton = screen.getByText("ES").closest("button");
    expect(esButton?.className).toContain("bg-white/20");
  });

  it("should highlight FR when locale is fr", () => {
    mockLocale = "fr";
    render(<LanguageSwitcher />);

    const frButton = screen.getByText("FR").closest("button");
    expect(frButton?.className).toContain("bg-white/20");
  });

  it("should highlight DE when locale is de", () => {
    mockLocale = "de";
    render(<LanguageSwitcher />);

    const deButton = screen.getByText("DE").closest("button");
    expect(deButton?.className).toContain("bg-white/20");
  });

  it("should highlight PT when locale is pt", () => {
    mockLocale = "pt";
    render(<LanguageSwitcher />);

    const ptButton = screen.getByText("PT").closest("button");
    expect(ptButton?.className).toContain("bg-white/20");
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

  it("should call setLocale with fr when FR is clicked", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByText("FR"));

    expect(mockSetLocale).toHaveBeenCalledWith("fr");
  });

  it("should call setLocale with de when DE is clicked", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByText("DE"));

    expect(mockSetLocale).toHaveBeenCalledWith("de");
  });

  it("should call setLocale with pt when PT is clicked", () => {
    mockLocale = "es";
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByText("PT"));

    expect(mockSetLocale).toHaveBeenCalledWith("pt");
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
