import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./chat-markdown";

describe("ChatMarkdown", () => {
  it("renders the markdown subset used by assistant chat responses", () => {
    const { container } = render(
      <ChatMarkdown content={"Intro with **bold text** and `code`.\n- First\n- Second\n\n1. Step one\n2. Step two\n\nVisit [Paisaxe](https://paisaxe.es)."} />
    );

    expect(screen.getByText("bold text")).toHaveClass("font-semibold");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.querySelector("ul")).toHaveClass("list-disc", "list-inside");
    expect(container.querySelector("ol")).toHaveClass("list-decimal", "list-inside");

    const link = screen.getByRole("link", { name: "Paisaxe" });
    expect(link).toHaveAttribute("href", "https://paisaxe.es");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders unsafe link URLs as text, not anchors", () => {
    render(<ChatMarkdown content={"Do not click [this](javascript:alert(1))."} />);

    expect(screen.queryByRole("link", { name: "this" })).not.toBeInTheDocument();
    expect(screen.getByText(/Do not click this\./)).toBeInTheDocument();
  });

  it("does not turn raw HTML into DOM nodes", () => {
    const { container } = render(
      <ChatMarkdown content={"<script>alert(1)</script> **safe**"} />
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText("safe")).toHaveClass("font-semibold");
  });
});
