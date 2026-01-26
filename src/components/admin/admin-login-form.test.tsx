import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminLoginForm } from "./admin-login-form";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  validateAdminKey: vi.fn(),
}));

// Import the mocked function for per-test control
import { validateAdminKey } from "@/lib/admin-api";

describe("AdminLoginForm", () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Paisaxe Admin header", () => {
    render(<AdminLoginForm onLogin={onLogin} />);
    expect(screen.getByText("Paisaxe Admin")).toBeInTheDocument();
  });

  it("renders a password input and a submit button", () => {
    render(<AdminLoginForm onLogin={onLogin} />);
    expect(screen.getByPlaceholderText("Access key")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
  });

  it("shows error when submitting an empty key", async () => {
    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText("Please enter the admin key")
    ).toBeInTheDocument();
    expect(validateAdminKey).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows error when submitting whitespace-only key", async () => {
    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText("Please enter the admin key")
    ).toBeInTheDocument();
    expect(validateAdminKey).not.toHaveBeenCalled();
  });

  it("calls validateAdminKey with the entered key", async () => {
    vi.mocked(validateAdminKey).mockResolvedValue(true);

    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "my-secret-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(validateAdminKey).toHaveBeenCalledWith("my-secret-key");
    });
  });

  it("calls onLogin with the key when validation succeeds", async () => {
    vi.mocked(validateAdminKey).mockResolvedValue(true);

    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "valid-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("valid-key");
    });
  });

  it("shows 'Invalid admin key' error when validation returns false", async () => {
    vi.mocked(validateAdminKey).mockResolvedValue(false);

    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "wrong-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText("Invalid admin key")
    ).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows 'Failed to validate key' when validateAdminKey throws", async () => {
    vi.mocked(validateAdminKey).mockRejectedValue(new Error("Server down"));

    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "some-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText("Failed to validate key")
    ).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows 'Verifying...' and disables the button during validation", async () => {
    // Create a promise we can control to keep the component in validating state
    let resolveValidation!: (value: boolean) => void;
    vi.mocked(validateAdminKey).mockImplementation(
      () => new Promise((resolve) => { resolveValidation = resolve; })
    );

    render(<AdminLoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "some-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // While validating, button should show "Verifying..." and be disabled
    await waitFor(() => {
      expect(screen.getByText("Verifying...")).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toBeDisabled();

    // Resolve and verify the button goes back to normal
    resolveValidation(true);

    await waitFor(() => {
      expect(screen.queryByText("Verifying...")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("renders subtitle text", () => {
    render(<AdminLoginForm onLogin={onLogin} />);
    expect(
      screen.getByText("Enter your access key to continue")
    ).toBeInTheDocument();
  });
});
