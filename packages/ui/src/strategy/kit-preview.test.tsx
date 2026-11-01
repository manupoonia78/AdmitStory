// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KitPreview, KitPreviewError, UnlockCta, unlockLabel } from "./kit-preview";

describe("UnlockCta", () => {
  it("reads exactly 'Unlock {School} for $100'", () => {
    expect(unlockLabel("Darden")).toBe("Unlock Darden for $100");
    const onUnlock = vi.fn();
    render(<UnlockCta pack="published" schoolName="Northfield" onUnlock={onUnlock} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock Northfield for $100" }));
    expect(onUnlock).toHaveBeenCalledOnce();
  });

  it("can be a link to checkout", () => {
    render(<UnlockCta pack="published" schoolName="Northfield" href="/checkout/northfield" />);
    expect(
      screen.getByRole("link", { name: "Unlock Northfield for $100" }).getAttribute("href"),
    ).toBe("/checkout/northfield");
  });

  it("can't be bought without a published pack, and offers to record interest", () => {
    const onAskToCover = vi.fn();
    render(<UnlockCta pack="coming_soon" schoolName="Westbridge" onAskToCover={onAskToCover} />);
    const soon = screen.getByRole("button", { name: "Pack coming soon" }) as HTMLButtonElement;
    expect(soon.disabled).toBe(true);
    expect(screen.queryByText(/for \$100/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask us to cover Westbridge" }));
    expect(onAskToCover).toHaveBeenCalledOnce();
  });

  it("says when interest is already recorded", () => {
    render(<UnlockCta pack="coming_soon" schoolName="Westbridge" asked />);
    expect(screen.queryByRole("button", { name: /Ask us/ })).toBeNull();
    expect(
      screen.getByText(
        "You asked us to cover Westbridge. Its kit can be bought once its pack is published.",
      ),
    ).toBeTruthy();
  });
});

describe("KitPreview", () => {
  it("shows the headline, the file map by title and the drafts present but locked", () => {
    const { container } = render(
      <KitPreview
        schoolName="Northfield"
        pack="published"
        positioning={{ headline: "An operator who builds the community around the system." }}
        fileMap={[
          { key: "essay-1", deliverable: "Essay 1", story: "The night-shift fix" },
          { key: "essay-2", deliverable: "Essay 2", story: null },
        ]}
        deliverables={[
          { key: "essay-1", title: "Essay 1", limit: "200 words", story: "The night-shift fix" },
          { key: "essay-2", title: "Essay 2", limit: "300 words" },
        ]}
      />,
    );
    expect(
      screen.getByText("An operator who builds the community around the system.").className,
    ).toContain("font-reading");
    expect(screen.getByText("No single story leads this one")).toBeTruthy();
    const locked = container.querySelectorAll("[data-locked]");
    expect(locked).toHaveLength(2);
    for (const row of locked) expect(row.textContent).toContain("Locked");
    expect(screen.getByRole("button", { name: "Unlock Northfield for $100" })).toBeTruthy();
  });
});

describe("KitPreviewError", () => {
  it("uses the house error copy and names the retry", () => {
    const onRetry = vi.fn();
    render(<KitPreviewError schoolName="Darden" othersReady onRetry={onRetry} />);
    expect(
      screen.getByText(
        "Darden's preview didn't finish. Your other previews are ready. Try Darden again?",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview Darden again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
