// @vitest-environment jsdom
import "../../test/dom";
import { PlusIcon } from "@phosphor-icons/react";
import { PlusIcon as ServerPlusIcon } from "@phosphor-icons/react/ssr";
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
    expect(link.className).toContain("frost-flat");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Button icons", () => {
  it("takes a pre-rendered icon element, hidden from screen readers and dimmed while loading", () => {
    render(
      <Button icon={<ServerPlusIcon size={20} />} loading>
        Adding a passkey
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Adding a passkey" });
    const wrapper = button.querySelector("span[aria-hidden]");
    expect(wrapper?.querySelector("svg")).toBeTruthy();
    expect(wrapper?.className).toContain("opacity-60");
  });
});

describe("Button arrow", () => {
  it("adds a decorative arrow circle to forward actions, and never at the small size", () => {
    render(
      <>
        <Button arrow>Start your story</Button>
        <Button arrow size="sm">
          Continue
        </Button>
      </>,
    );
    const forward = screen.getByRole("button", { name: "Start your story" });
    const arrow = forward.querySelector(".btn-arrow");
    expect(arrow?.getAttribute("aria-hidden")).toBe("true");
    expect(forward.lastElementChild).toBe(arrow);
    expect(screen.getByRole("button", { name: "Continue" }).querySelector(".btn-arrow")).toBeNull();
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
