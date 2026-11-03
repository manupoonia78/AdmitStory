// @vitest-environment jsdom
import "../../test/dom";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImmersiveScope } from "./immersive-scope";
import { setThemePreference } from "./theme-store";

function scope(): HTMLElement {
  return screen.getByTestId("scope");
}

// Since the paper redesign, immersive screens follow the page's theme instead of forcing Night.
describe("ImmersiveScope", () => {
  it("marks the subtree immersive without setting a theme of its own", () => {
    render(<ImmersiveScope data-testid="scope">Studio</ImmersiveScope>);
    expect(scope().hasAttribute("data-immersive")).toBe(true);
    expect(scope().hasAttribute("data-theme")).toBe(false);
  });

  it("keeps inheriting whichever theme the user picks", () => {
    render(<ImmersiveScope data-testid="scope">Studio</ImmersiveScope>);
    act(() => setThemePreference("night"));
    expect(scope().hasAttribute("data-theme")).toBe(false);
    act(() => setThemePreference("day"));
    expect(scope().hasAttribute("data-theme")).toBe(false);
  });

  it("renders no theme attribute on the server either", () => {
    for (const serverValue of ["day", "night", "system"] as const) {
      expect(
        renderToString(<ImmersiveScope serverValue={serverValue}>Studio</ImmersiveScope>),
      ).not.toContain("data-theme");
    }
  });
});
