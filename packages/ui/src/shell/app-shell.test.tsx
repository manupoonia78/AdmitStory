// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let pathname = "/studio/session-1";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
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
const { NAV_ITEMS } = await import("./nav-items");
const { NAV_ICONS } = await import("./nav-icons");

// Synthetic applicant (spec §0: no real people in tests).
const user = { name: "Asha Verma", email: "asha@example.test" };

// The palette is a lazy chunk. Under a full parallel run its first import can outlast a test's
// 5 s budget, so it is loaded once up front; the shell's own lazy import then resolves at once.
const LAZY = { timeout: 3000 };

const DESTINATIONS = ["Home", "Story", "Dossier", "Schools", "Interview", "Connect", "Tracker"];

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

function dock() {
  const element = document.querySelector<HTMLElement>('[data-slot="dock"]');
  if (!element) throw new Error("no dock");
  return element;
}

describe("AppShell", () => {
  beforeAll(async () => {
    await import("./command-palette");
  }, 60_000);

  beforeEach(() => {
    push.mockReset();
    pathname = "/studio/session-1";
  });

  it("lists every destination by its label and marks the current one", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(DESTINATIONS);
    // The label is each link's accessible name even while the closed dock hides it visually.
    for (const label of DESTINATIONS) {
      expect(within(nav).getByRole("link", { name: label })).toBeTruthy();
    }

    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("href")).toBe("/studio");
  });

  it("shows a decorative icon in every dock item, rendered by the server half", () => {
    renderShell();
    const items = [
      screen.getByRole("button", { name: "Search or jump to…" }),
      ...within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link"),
    ];
    for (const item of items) {
      const icon = item.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("keeps icon code out of the destinations the client dock imports", () => {
    // Each Phosphor icon carries all six weights; only nav-icons.ts may reference them.
    for (const item of NAV_ITEMS) {
      expect(Object.keys(item).sort()).toEqual(["href", "id", "label"]);
      expect(NAV_ICONS[item.id]).toBeTruthy();
    }
  });

  it("glides one veil to the current destination, and rests it when none is current", () => {
    const { unmount } = renderShell();
    const track = screen.getByRole("navigation", { name: "Main" }).firstElementChild as HTMLElement;
    expect(track.style.getPropertyValue("--dock-index")).toBe("1");
    expect(track.style.getPropertyValue("--dock-count")).toBe(String(DESTINATIONS.length));
    const veil = track.querySelector('[aria-hidden="true"]');
    expect(veil?.hasAttribute("data-idle")).toBe(false);
    unmount();

    pathname = "/settings";
    renderShell();
    const idleTrack = screen.getByRole("navigation", { name: "Main" })
      .firstElementChild as HTMLElement;
    expect(idleTrack.querySelector('[aria-hidden="true"]')?.hasAttribute("data-idle")).toBe(true);
    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
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

  it("puts the page inside the route transition wrapper", () => {
    renderShell();
    const content = screen.getByRole("main").querySelector('[data-slot="route-content"]');
    expect(content?.querySelector("h1")?.textContent).toBe("Story Studio");
  });

  it("keeps the dock reachable on short screens, with keyboard order down the dock", () => {
    renderShell();
    const classes = dock().className.split(" ");
    // jsdom has no layout; apps/web's e2e checks a short landscape viewport (844×390).
    expect(classes).toEqual(
      expect.arrayContaining(["sm:overflow-y-auto", "sm:max-h-[calc(100dvh-1.5rem)]"]),
    );
    // Search first, then the destinations, then the account trigger at the bottom.
    const focusable = [...dock().querySelectorAll("a, button")].map(
      (el) => el.getAttribute("aria-label") ?? el.textContent,
    );
    expect(focusable[0]).toBe("Search or jump to…");
    expect(focusable.slice(1, 1 + DESTINATIONS.length)).toEqual(DESTINATIONS);
    expect(focusable.at(-1)).toContain("Account");
  });

  it("opens with keyboard focus and folds away on Escape until focus leaves", () => {
    renderShell();
    const home = screen.getByRole("link", { name: "Home" });
    act(() => home.focus());
    expect(dock().className).toContain("sm:has-[:focus-visible]:w-52");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dock().hasAttribute("data-folded")).toBe(true);
    // Moving within the dock keeps it folded…
    fireEvent.blur(home, { relatedTarget: screen.getByRole("link", { name: "Story" }) });
    expect(dock().hasAttribute("data-folded")).toBe(true);
    // …leaving it lets it open again next time.
    fireEvent.blur(home, { relatedTarget: screen.getByRole("main") });
    expect(dock().hasAttribute("data-folded")).toBe(false);
  });

  it("leaves an Escape that closed something else alone", () => {
    renderShell();
    act(() => screen.getByRole("link", { name: "Home" }).focus());
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    act(() => {
      document.dispatchEvent(event);
    });
    expect(dock().hasAttribute("data-folded")).toBe(false);
  });

  it("opens the command palette with Ctrl K and lists destinations and actions", async () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const dialog = await screen.findByRole("dialog", { name: "Search or jump to…" }, LAZY);
    const options = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([
      ...DESTINATIONS,
      "Record a new story",
      "Switch to Night",
      "Switch to Day",
      "Match system theme",
    ]);
    expect(document.activeElement).toBe(within(dialog).getByRole("combobox"));
    expect(within(dialog).getByRole("status").textContent).toBe(
      `${DESTINATIONS.length + 4} results`,
    );
  });

  it("narrows results live as you type and says how many are left", async () => {
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", {}, LAZY);
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "interview" } });
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Interview"]);
    expect(within(dialog).getByRole("status").textContent).toBe("1 result");
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

  it("navigates with the route transition and runs actions from the palette, then closes", async () => {
    const onAction = vi.fn();
    renderShell(onAction);
    fireEvent.click(screen.getByRole("button", { name: "Search or jump to…" }));

    const dialog = await screen.findByRole("dialog", {}, LAZY);
    fireEvent.click(within(dialog).getByRole("option", { name: "Record a new story" }));

    expect(push).toHaveBeenCalledWith("/studio/new", { transitionTypes: ["route"] });
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches the theme from the palette without navigating", async () => {
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", {}, LAZY);
    fireEvent.click(within(dialog).getByRole("option", { name: "Switch to Night" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("night");
    expect(push).not.toHaveBeenCalled();
  });
});
