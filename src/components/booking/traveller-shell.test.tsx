import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, @typescript-eslint/no-unused-vars
  default: ({ fill, priority, ...props }: Record<string, unknown>) => <img {...props} />,
}));

const { TicketCard, TravellerShell } = await import("./traveller-shell");

describe("TravellerShell", () => {
  it("renders the children inside the page's main landmark", () => {
    render(
      <TravellerShell photo="/images/stories/descenso-del-sella.webp">
        <p>contenido</p>
      </TravellerShell>
    );
    expect(screen.getByRole("main")).toContainElement(screen.getByText("contenido"));
  });

  it("shows the photo as decoration only", () => {
    const { container } = render(
      <TravellerShell photo="/images/stories/descenso-del-sella.webp">
        <p>x</p>
      </TravellerShell>
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/images/stories/descenso-del-sella.webp");
    expect(img).toHaveAttribute("alt", "");
  });

  it("renders no image without a photo (plain neutral-950 page)", () => {
    const { container } = render(
      <TravellerShell>
        <p>x</p>
      </TravellerShell>
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("main")).toHaveClass("bg-neutral-950");
  });

  it("links the Paisaxe mark home", () => {
    render(
      <TravellerShell>
        <p>x</p>
      </TravellerShell>
    );
    expect(screen.getByRole("link", { name: "Paisaxe" })).toHaveAttribute("href", "/");
  });
});

describe("TicketCard", () => {
  it("is a smoked frosted panel, dark enough for white text over any photo", () => {
    render(<TicketCard>ticket</TicketCard>);
    const card = screen.getByText("ticket");
    expect(card).toHaveClass("bg-neutral-950/60", "backdrop-blur-xl", "border-white/20", "rounded-2xl");
    expect(card).not.toHaveClass("bg-white/10");
  });
});
