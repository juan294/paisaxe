import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";
import Home from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

describe("Home Page", () => {
  it("should redirect to /immersive", async () => {
    // Call the component function
    try {
      await Home();
    } catch {
      // redirect throws NEXT_REDIRECT error which is expected
    }

    expect(redirect).toHaveBeenCalledWith("/immersive");
  });

  it("should be the default export", () => {
    expect(typeof Home).toBe("function");
  });
});
