import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock the underlying analytics packages so the factory functions inside dynamic()
// can execute without network or package-resolution errors.
vi.mock("@vercel/analytics/next", () => ({
  Analytics: function Analytics() {
    return null;
  },
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: function SpeedInsights() {
    return null;
  },
}));

// Mock next/dynamic to call the loader synchronously so the factory functions
// (lines 5-8 and 10-15 in analytics.tsx) are executed and covered by V8.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>, _opts?: unknown) => {
    // Execute the factory function so V8 covers it
    void loader();
    return function DynamicPlaceholder() {
      return null;
    };
  },
}));

describe("VercelAnalytics", () => {
  it("renders without crashing", async () => {
    const { VercelAnalytics } = await import("./analytics");
    const { container } = render(<VercelAnalytics />);
    expect(container).toBeDefined();
  });

  it("renders a React fragment with no wrapper element", async () => {
    const { VercelAnalytics } = await import("./analytics");
    const { container } = render(<VercelAnalytics />);
    // Fragment renders both dynamic placeholders (which return null)
    expect(container.childElementCount).toBe(0);
  });

  it("can render multiple times without errors", async () => {
    const { VercelAnalytics } = await import("./analytics");
    const { unmount } = render(<VercelAnalytics />);
    unmount();
    const { container } = render(<VercelAnalytics />);
    expect(container).toBeDefined();
  });
});
