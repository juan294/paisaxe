import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminThemeProvider } from "./theme-provider";

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    storageKey?: string;
  }) => (
    <div
      data-testid="theme-provider"
      data-attribute={props.attribute}
      data-default-theme={props.defaultTheme}
      data-enable-system={String(props.enableSystem)}
      data-storage-key={props.storageKey}
    >
      {children}
    </div>
  ),
}));

describe("AdminThemeProvider", () => {
  it("should render children", () => {
    render(
      <AdminThemeProvider>
        <div data-testid="child">Child content</div>
      </AdminThemeProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("should pass correct props to ThemeProvider", () => {
    render(
      <AdminThemeProvider>
        <div>Content</div>
      </AdminThemeProvider>
    );

    const provider = screen.getByTestId("theme-provider");
    expect(provider).toHaveAttribute("data-attribute", "class");
    expect(provider).toHaveAttribute("data-default-theme", "dark");
    expect(provider).toHaveAttribute("data-enable-system", "false");
    expect(provider).toHaveAttribute("data-storage-key", "paisaxe-admin-theme");
  });

  it("should allow overriding default props", () => {
    render(
      <AdminThemeProvider defaultTheme="light" enableSystem={true}>
        <div>Content</div>
      </AdminThemeProvider>
    );

    const provider = screen.getByTestId("theme-provider");
    expect(provider).toHaveAttribute("data-default-theme", "light");
    expect(provider).toHaveAttribute("data-enable-system", "true");
  });
});
