import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrivacyNotice } from "./privacy-notice";

describe("PrivacyNotice", () => {
  it("should render notice text", () => {
    render(<PrivacyNotice onDismiss={() => {}} />);

    expect(
      screen.getByText(/Tus preguntas se procesan con inteligencia artificial/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No guardamos tus conversaciones/)
    ).toBeInTheDocument();
  });

  it("should render dismiss button", () => {
    render(<PrivacyNotice onDismiss={() => {}} />);

    expect(screen.getByText("Entendido")).toBeInTheDocument();
  });

  it("should call onDismiss when button is clicked", () => {
    const onDismiss = vi.fn();
    render(<PrivacyNotice onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText("Entendido"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
