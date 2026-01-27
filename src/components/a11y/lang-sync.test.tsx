import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { LangSync } from "./lang-sync";

let mockLocale = "en";
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

describe("LangSync", () => {
  const originalLang = document.documentElement.lang;

  afterEach(() => {
    document.documentElement.lang = originalLang;
  });

  it("sets document.documentElement.lang to the current locale", () => {
    mockLocale = "en";
    render(<LangSync />);

    expect(document.documentElement.lang).toBe("en");
  });

  it("updates document.documentElement.lang when locale changes", () => {
    mockLocale = "en";
    const { unmount } = render(<LangSync />);
    expect(document.documentElement.lang).toBe("en");
    unmount();

    mockLocale = "es";
    render(<LangSync />);
    expect(document.documentElement.lang).toBe("es");
  });
});
