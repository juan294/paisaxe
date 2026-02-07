import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/provider";
import { ComponentErrorBoundary } from "./component-error-boundary";

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  return () => {
    console.error = originalError;
  };
});

// Component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Child content</div>;
}

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLocale="en">{ui}</LanguageProvider>
  );
}

describe("ComponentErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    renderWithI18n(
      <ComponentErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    renderWithI18n(
      <ComponentErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ComponentErrorBoundary>
    );
    expect(screen.queryByText("Child content")).not.toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("resets when 'Try again' button is clicked", () => {
    let shouldThrow = true;
    function ConditionalThrow() {
      if (shouldThrow) throw new Error("Test error");
      return <div>Recovered content</div>;
    }

    renderWithI18n(
      <ComponentErrorBoundary>
        <ConditionalThrow />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error condition before clicking retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("respects i18n - shows Spanish text with es locale", () => {
    render(
      <LanguageProvider initialLocale="es">
        <ComponentErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ComponentErrorBoundary>
      </LanguageProvider>
    );

    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("logs error to console", () => {
    renderWithI18n(
      <ComponentErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ComponentErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it("does not render a full-page error - fallback is inline", () => {
    renderWithI18n(
      <ComponentErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ComponentErrorBoundary>
    );

    // The fallback should be a small inline element, NOT a full-page div
    const fallback = screen.getByRole("alert");
    expect(fallback).toBeInTheDocument();
    // Should not have min-h-screen (full page)
    expect(fallback.className).not.toContain("min-h-screen");
  });

  it("calls onError callback if provided", () => {
    const onError = vi.fn();
    renderWithI18n(
      <ComponentErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ComponentErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });
});
