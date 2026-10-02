import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef, useState } from "react";
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

// Component that throws a non-Error value (e.g. a plain string), which React
// error boundaries still catch via componentDidCatch(error, errorInfo).
function ThrowingNonErrorChild(): never {
   
  throw "raw string failure";
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

  it("uses translation key as fallback text when rendered without LanguageProvider", () => {
    // Render WITHOUT LanguageProvider so this.context is null,
    // covering the fallback: (key: string) => key
    render(
      <ComponentErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ComponentErrorBoundary>
    );

    // Without a provider, t falls back to identity function — renders raw translation keys
    expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "errors.retry" })).toBeInTheDocument();
  });

  it("actually remounts the child subtree on retry, discarding stale instance state", () => {
    // Models a child whose internal instance state (e.g. a stale ref to a
    // connection/handle) becomes corrupted after mount and, once corrupted,
    // throws on every subsequent render of that SAME instance. A `useRef`
    // initial value only runs once per mount, so only a true remount (a
    // fresh instance) clears it -- merely flipping `hasError` back to
    // `false` and re-rendering the same element does not, because React
    // does not treat that as a new mount.
    let triggerCorruption = true;
    function CorruptibleChild() {
      const corruptedRef = useRef(false);
      if (triggerCorruption) {
        corruptedRef.current = true;
      }
      if (corruptedRef.current) {
        throw new Error("corrupted instance state");
      }
      return <div>Recovered content</div>;
    }

    renderWithI18n(
      <ComponentErrorBoundary>
        <CorruptibleChild />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // "Fix" the external condition that caused the original error, then retry.
    triggerCorruption = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // A real remount creates a brand new CorruptibleChild instance, whose
    // ref starts fresh at `false`, so it renders successfully this time.
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("mounts a fresh child instance on every retry, not just once", () => {
    // Tracks how many times a genuinely new fiber/instance was created.
    // A `useState` lazy initializer runs exactly once per fresh mount,
    // synchronously during render -- even if that same render goes on to
    // throw -- so it accurately counts "how many times a distinct
    // instance was created," unlike an effect (which only fires after a
    // successful commit and would never run for a throwing render).
    let mountCount = 0;
    let shouldThrow = true;
    function CountingChild() {
      useState(() => {
        mountCount += 1;
        return null;
      });
      if (shouldThrow) throw new Error("still broken");
      return <div>Recovered content</div>;
    }

    renderWithI18n(
      <ComponentErrorBoundary>
        <CountingChild />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    const countAfterInitialMount = mountCount;
    expect(countAfterInitialMount).toBeGreaterThan(0);

    // First retry: still broken, crashes again immediately -- but a fresh
    // instance must still have been created for this attempt.
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    const countAfterFirstRetry = mountCount;
    expect(countAfterFirstRetry).toBeGreaterThan(countAfterInitialMount);

    // Second retry: now fixed, recovers -- again via a fresh instance.
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(mountCount).toBeGreaterThan(countAfterFirstRetry);
  });

  it("handles non-Error throws via String(error) fallback", () => {
    renderWithI18n(
      <ComponentErrorBoundary>
        <ThrowingNonErrorChild />
      </ComponentErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });
});
