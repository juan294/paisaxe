import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ComingSoonPage from "./page";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: null,
              })
            ),
          })),
        })),
      })),
    })),
  },
}));

// Mock environment
vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "production"),
}));

// Mock Logo component
vi.mock("@/components/ui/logo", () => ({
  Logo: ({ primaryColor }: { primaryColor: string }) => (
    <div data-testid="logo" data-color={primaryColor}>
      Logo
    </div>
  ),
}));

import { supabase } from "@/lib/supabase";

describe("ComingSoonPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with default config when no maintenance config exists", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: "PGRST116" },
              })
            ),
          })),
        })),
      })),
    } as never);

    const page = await ComingSoonPage();
    render(page);

    expect(screen.getByText("PAISAXE")).toBeInTheDocument();
    expect(screen.getByText("Look. Ask. Discover.")).toBeInTheDocument();
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
  });

  it("should render with custom config from database", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  config: {
                    title: "Custom Title",
                    message: "Custom message here",
                    show_tagline: true,
                  },
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    } as never);

    const page = await ComingSoonPage();
    render(page);

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom message here")).toBeInTheDocument();
    expect(screen.getByText("Look. Ask. Discover.")).toBeInTheDocument();
  });

  it("should hide tagline when show_tagline is false", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  config: {
                    title: "Maintenance",
                    message: "",
                    show_tagline: false,
                  },
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    } as never);

    const page = await ComingSoonPage();
    render(page);

    expect(screen.queryByText("Look. Ask. Discover.")).not.toBeInTheDocument();
  });

  it("should not render message when empty", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  config: {
                    title: "Próximamente",
                    message: "",
                    show_tagline: true,
                  },
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    } as never);

    const page = await ComingSoonPage();
    const { container } = render(page);

    // Message paragraph should not exist if message is empty
    const messageParagraphs = container.querySelectorAll("p.mt-6");
    expect(messageParagraphs.length).toBe(0);
  });

  it("should render logo with correct color", async () => {
    const page = await ComingSoonPage();
    render(page);

    const logo = screen.getByTestId("logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-color", "currentColor");
  });

  it("should handle database errors gracefully", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    const page = await ComingSoonPage();
    render(page);

    // Should fall back to default config
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
  });
});
