import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { StoryRedirectClient } from "./story-redirect-client";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("StoryRedirectClient (FE-H2 / #760)", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("hands off to the given href via router.replace on mount", () => {
    render(<StoryRedirectClient href="/immersive?story=lagos-covadonga" />);

    expect(mockReplace).toHaveBeenCalledWith("/immersive?story=lagos-covadonga");
  });

  it("renders no visible content (crawlers without JS see only the page's static content)", () => {
    const { container } = render(
      <StoryRedirectClient href="/immersive?story=lagos-covadonga" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("replaces again if the href changes", () => {
    const { rerender } = render(
      <StoryRedirectClient href="/immersive?story=first" />
    );
    expect(mockReplace).toHaveBeenCalledWith("/immersive?story=first");

    rerender(<StoryRedirectClient href="/immersive?story=second" />);
    expect(mockReplace).toHaveBeenCalledWith("/immersive?story=second");
  });
});
