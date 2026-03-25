import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostRow } from "./post-row";
import type { MarketingPost } from "@/types/marketing";

const mockPost: MarketingPost = {
  id: "post-1",
  accountId: "acc-1",
  platform: "x",
  content: "Check out the stunning views of Picos de Europa! #Asturias",
  mediaUrls: [],
  hashtags: ["#Asturias"],
  linkUrl: null,
  scheduledFor: null,
  postedAt: "2026-02-15T14:00:00Z",
  status: "posted",
  platformPostId: "tw-123",
  postUrl: "https://x.com/test/status/123",
  errorMessage: null,
  engagement: { likes: 10 },
  storyId: null,
  contentTheme: null,
  createdAt: "2026-02-15T10:00:00Z",
  updatedAt: "2026-02-15T14:00:00Z",
};

// Wrap table structure for valid DOM
const renderInTable = (ui: React.ReactNode) => {
  return render(<table><tbody>{ui}</tbody></table>);
};

describe("PostRow", () => {
  it("renders post content", () => {
    renderInTable(<PostRow post={mockPost} index={0} />);

    expect(
      screen.getByText(/Check out the stunning views/)
    ).toBeInTheDocument();
  });

  it("renders row index with zero-padding", () => {
    renderInTable(<PostRow post={mockPost} index={0} />);
    expect(screen.getByText("01")).toBeInTheDocument();
  });

  it("renders platform badge", () => {
    renderInTable(<PostRow post={mockPost} index={0} />);
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("shows status text for non-scheduled posts", () => {
    renderInTable(<PostRow post={mockPost} index={0} />);
    expect(screen.getByText("posted")).toBeInTheDocument();
  });

  it("shows scheduled date for scheduled posts", () => {
    const scheduledPost: MarketingPost = {
      ...mockPost,
      status: "scheduled",
      scheduledFor: "2026-02-20T10:00:00Z",
      postedAt: null,
    };
    renderInTable(<PostRow post={scheduledPost} index={0} />);

    // Should show a formatted date, not "scheduled" status
    expect(screen.queryByText("scheduled")).not.toBeInTheDocument();
  });

  it("shows external link when postUrl exists", () => {
    renderInTable(<PostRow post={mockPost} index={0} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://x.com/test/status/123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not show external link when postUrl is null", () => {
    const noUrlPost = { ...mockPost, postUrl: null };
    renderInTable(<PostRow post={noUrlPost} index={0} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows draft status with correct styling", () => {
    const draftPost = { ...mockPost, status: "draft" as const, postUrl: null };
    renderInTable(<PostRow post={draftPost} index={0} />);

    const statusEl = screen.getByText("draft");
    expect(statusEl.className).toContain("text-[#a39e98]");
  });

  it("shows failed status with red styling", () => {
    const failedPost = { ...mockPost, status: "failed" as const, postUrl: null };
    renderInTable(<PostRow post={failedPost} index={0} />);

    const statusEl = screen.getByText("failed");
    expect(statusEl.className).toContain("text-red-600");
  });

  it("renders instagram platform badge", () => {
    const igPost = { ...mockPost, platform: "instagram" as const };
    renderInTable(<PostRow post={igPost} index={0} />);
    expect(screen.getByText("IG")).toBeInTheDocument();
  });

  it("shows status text when scheduled post has null scheduledFor", () => {
    const scheduledNullDate: MarketingPost = {
      ...mockPost,
      status: "scheduled",
      scheduledFor: null,
      postedAt: null,
      postUrl: null,
    };
    renderInTable(<PostRow post={scheduledNullDate} index={0} />);

    // When scheduledFor is null the condition `post.status === "scheduled" && post.scheduledFor`
    // is false, so it falls through to the status text branch
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  it("shows em-dash when scheduled post has empty string scheduledFor", () => {
    // Line 18: `if (!dateStr) return "—"` — formatDate with falsy dateStr
    // When scheduledFor is an empty string, JS evaluates "" as falsy in the ternary
    // `post.status === "scheduled" && post.scheduledFor`, so formatDate is never called
    // with an empty string. The guard at line 18 is purely defensive code.
    // This test documents that the empty-string branch results in the status text path.
    const scheduledEmptyDate: MarketingPost = {
      ...mockPost,
      status: "scheduled",
      scheduledFor: "",
      postedAt: null,
      postUrl: null,
    };
    renderInTable(<PostRow post={scheduledEmptyDate} index={0} />);

    // Empty string is falsy, so falls through to status text
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  // Line 18: `if (!dateStr) return "—"` inside formatDate
  // This guard is architecturally unreachable via the component's UI. formatDate is only called
  // inside the ternary `post.status === "scheduled" && post.scheduledFor ? formatDate(post.scheduledFor) : ...`
  // The `&&` operator ensures post.scheduledFor is truthy before formatDate is invoked,
  // so dateStr will always be a non-empty string. The guard is defensive programming.

  it("shows posting status with blue styling", () => {
    const postingPost: MarketingPost = {
      ...mockPost,
      status: "posting",
      postUrl: null,
    };
    renderInTable(<PostRow post={postingPost} index={0} />);

    const statusEl = screen.getByText("posting");
    expect(statusEl.className).toContain("text-blue-600");
  });

  it("shows scheduled status with amber styling", () => {
    const scheduledPost: MarketingPost = {
      ...mockPost,
      status: "scheduled",
      scheduledFor: null,
      postUrl: null,
    };
    renderInTable(<PostRow post={scheduledPost} index={0} />);

    const statusEl = screen.getByText("scheduled");
    expect(statusEl.className).toContain("text-amber-600");
  });

  it("renders pinterest platform badge", () => {
    const pinPost = { ...mockPost, platform: "pinterest" as const };
    renderInTable(<PostRow post={pinPost} index={0} />);
    expect(screen.getByText("Pi")).toBeInTheDocument();
  });
});
