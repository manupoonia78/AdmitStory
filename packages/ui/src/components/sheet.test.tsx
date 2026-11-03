// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Drawer, DrawerContent } from "./drawer";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";

function renderSheet() {
  return render(
    <Sheet>
      <SheetTrigger>Why this draft</SheetTrigger>
      <SheetContent title="Why this draft" description="The story and the trait it shows.">
        <p>Eight people in a park.</p>
      </SheetContent>
    </Sheet>,
  );
}

describe("Sheet", () => {
  it("opens as a dialog named by its title, with focus inside", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Why this draft" }));
    const sheet = screen.getByRole("dialog", { name: "Why this draft" });
    expect(sheet.getAttribute("aria-describedby")).toBeTruthy();
    expect(sheet.contains(document.activeElement)).toBe(true);
  });

  it("uses the 28px sheet radius and glides in on the sheet animation", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Why this draft" }));
    const classes = screen.getByRole("dialog").className;
    expect(classes).toContain("rounded-l-sheet");
    expect(classes).toContain("data-[state=open]:animate-sheet-in");
  });

  it("closes with its Close button and returns focus to the trigger", async () => {
    renderSheet();
    const trigger = screen.getByRole("button", { name: "Why this draft" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("is still available under its Phase 0 name, Drawer", () => {
    render(
      <Drawer open>
        <DrawerContent title="Evidence">Notes</DrawerContent>
      </Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Evidence" })).toBeTruthy();
  });
});
