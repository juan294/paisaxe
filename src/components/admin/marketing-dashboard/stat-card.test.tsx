import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renders number, value, and label", () => {
    render(<StatCard number="01" value={42} label="Total Posts" />);

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total Posts")).toBeInTheDocument();
  });

  it("formats large values with locale string", () => {
    render(<StatCard number="02" value={1234} label="Engagement" />);

    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("applies color class when provided", () => {
    const { container } = render(
      <StatCard number="01" value={10} label="Test" color="blue" />
    );

    const valueEl = container.querySelector(".text-blue-600");
    expect(valueEl).toBeInTheDocument();
  });

  it("applies error styling when isError and value > 0", () => {
    const { container } = render(
      <StatCard number="01" value={5} label="Failures" isError />
    );

    const valueEl = container.querySelector(".text-red-500");
    expect(valueEl).toBeInTheDocument();
  });

  it("does not apply error styling when isError but value is 0", () => {
    const { container } = render(
      <StatCard number="01" value={0} label="Failures" isError />
    );

    const valueEl = container.querySelector(".text-red-500");
    expect(valueEl).not.toBeInTheDocument();
  });

  it("uses default text color when no color or error", () => {
    const { container } = render(
      <StatCard number="01" value={10} label="Test" />
    );

    const valueEl = container.querySelector('[class*="text-5xl"]');
    expect(valueEl?.className).toContain("text-[#2d2a26]");
  });
});
