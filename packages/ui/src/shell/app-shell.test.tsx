// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/studio/session-1",
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const { AppShell } = await import("./app-shell");

// Synthetic applicant (spec §0: no real people in tests).
const user = { name: "Asha Verma", email: "asha@example.test" };

function renderShell(onAction = vi.fn()) {
  return render(
    <AppShell
      user={user}
      onSignOut={vi.fn()}
      actions={[
        {
          id: "record-story",
          label: "Record a new story",
          href: "/studio/new",
          onSelect: onAction,
        },
      ]}
    >
      <h1>Story Studio</h1>
    </AppShell>,
  );
}

describe("AppShell", () => {
  beforeEach(() => push.mockReset());

  it("lists the six destinations and marks the current one", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Home",
      "Story",
      "Schools",
      "Interview",
      "Connect",
      "Tracker",
    ]);

    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("href")).toBe("/studio");
  });

  it("starts with a skip link to the main landmark", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip.getAttribute("href")).toBe("#main");
    const main = screen.getByRole("main");
    expect(main.id).toBe("main");
    expect(main.getAttribute("tabindex")).toBe("-1");
    // The skip link is the first focusable element on the page.
    expect(document.querySelector("a, button")).toBe(skip);
  });

  it("opens the command palette with Ctrl K and lists destinations and actions", async () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const dialog = await screen.findByRole("dialog", { name: "Search or jump to…" });
    const options = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([
      "Home",
      "Story",
      "Schools",
      "Interview",
      "Connect",
      "Tracker",
      "Record a new story",
    ]);
    expect(document.activeElement).toBe(within(dialog).getByRole("combobox"));
  });

  it("ignores a keydown with no key (Chrome sends one on autofill)", () => {
    renderShell();
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener("error", onError);
    try {
      window.dispatchEvent(new Event("keydown"));
    } finally {
      window.removeEventListener("error", onError);
    }
    expect(errors).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the rail scroll, so every destination and the account menu stay reachable", () => {
    renderShell();
    const rail = screen.getByRole("navigation", { name: "Main" }).parentElement;
    expect(rail?.getAttribute("data-slot")).toBe("rail");
    // jsdom has no layout; apps/web's e2e checks a short landscape viewport (844×390).
    expect(rail?.className.split(" ")).toEqual(
      expect.arrayContaining(["sm:inset-y-0", "sm:overflow-y-auto"]),
    );
    // Keyboard order still runs down the rail: destinations, then the account trigger.
    const focusable = [...rail!.querySelectorAll("a, button")].map(
      (el) => el.textContent || el.getAttribute("aria-label"),
    );
    expect(focusable.slice(-1)[0]).toContain("Account");
  });

  it("navigates and runs actions from the palette, then closes", async () => {
    const onAction = vi.fn();
    renderShell(onAction);
    fireEvent.click(screen.getByRole("button", { name: "Search or jump to…" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("option", { name: "Record a new story" }));

    expect(push).toHaveBeenCalledWith("/studio/new");
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
