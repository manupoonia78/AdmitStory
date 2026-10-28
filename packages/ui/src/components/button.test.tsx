// @vitest-environment jsdom
import "../../test/dom";
import { PlusIcon } from "@phosphor-icons/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { IconButton } from "./icon-button";

describe("Button", () => {
  it("is a real button that does not submit forms by default", () => {
    render(<Button>Start talking</Button>);
    const button = screen.getByRole("button", { name: "Start talking" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("stays focusable but ignores clicks while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with button styling when asChild is set", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/studio">Open Story Studio</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Open Story Studio" });
    expect(link.getAttribute("href")).toBe("/studio");
    expect(link.className).toContain("border-slate");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("IconButton", () => {
  it("takes its accessible name from aria-label and hides the icon", () => {
    const { container } = render(<IconButton icon={PlusIcon} aria-label="Add a school" />);
    expect(screen.getByRole("button", { name: "Add a school" })).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has a 44px target at the default size", () => {
    render(<IconButton icon={PlusIcon} aria-label="Add a school" />);
    expect(screen.getByRole("button").className).toContain("size-11");
  });
});
