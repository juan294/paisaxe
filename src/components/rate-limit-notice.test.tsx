import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RateLimitNotice } from "./rate-limit-notice";
describe("rate denial recovery", () => {
  it("announces timing and offers an executable retry action", () => {
    const retry = vi.fn(); render(<RateLimitNotice retryAfter={13} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("13 segundos");
    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" })); expect(retry).toHaveBeenCalledOnce();
  });
});
