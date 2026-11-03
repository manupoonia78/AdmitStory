// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("left-aligns by default, so a description of any length reads as normal text", () => {
    render(
      <EmptyState
        title="No stories yet"
        description="Record your first story and we will find the moments worth writing about. It takes about ten minutes."
      />,
    );
    const root = screen.getByRole("heading", { name: "No stories yet" }).parentElement;
    expect(root?.className).toContain("text-left");
    expect(root?.className).not.toContain("text-center");
    expect(root?.getAttribute("data-align")).toBe("start");
  });

  it("centres only when asked to, for a single-line state", () => {
    render(
      <EmptyState align="center" title="No schools yet" description="Add a school to start." />,
    );
    const root = screen.getByRole("heading", { name: "No schools yet" }).parentElement;
    expect(root?.className).toContain("text-center");
    expect(root?.className).toContain("items-center");
  });
});
