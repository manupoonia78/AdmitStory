// @vitest-environment jsdom
import "../../test/dom";
import { PlusIcon } from "@phosphor-icons/react";
import { PlusIcon as ServerPlusIcon } from "@phosphor-icons/react/ssr";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(link.className).toContain("border-control");
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

describe("Button magnetic pull", () => {
  afterEach(() => vi.unstubAllGlobals());

  function hover(button: HTMLElement) {
    button.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 120, height: 44, right: 120, bottom: 44 }) as DOMRect;
    const event = new MouseEvent("pointermove", { clientX: 120, clientY: 22, bubbles: true });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    button.dispatchEvent(event);
  }

  it("leans primary actions towards a fine pointer, and leaves other variants still", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: fine)",
      media: query,
    }));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    render(
      <>
        <Button>Start talking</Button>
        <Button variant="secondary">Write instead</Button>
      </>,
    );
    const primary = screen.getByRole("button", { name: "Start talking" });
    const secondary = screen.getByRole("button", { name: "Write instead" });
    hover(primary);
    hover(secondary);
    expect(primary.style.translate).toBe("6px 0px");
    expect(secondary.style.translate).toBe("");
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
