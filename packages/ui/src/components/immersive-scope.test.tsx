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

describe("ImmersiveScope", () => {
  it("is Night when the user follows the system", () => {
    render(<ImmersiveScope data-testid="scope">Studio</ImmersiveScope>);
    expect(scope().getAttribute("data-theme")).toBe("night");
    expect(scope().hasAttribute("data-immersive")).toBe(true);
  });

  it("stays Night when Night was chosen, and steps aside for an explicit Day", () => {
    render(<ImmersiveScope data-testid="scope">Studio</ImmersiveScope>);
    act(() => setThemePreference("night"));
    expect(scope().getAttribute("data-theme")).toBe("night");
    act(() => setThemePreference("day"));
    expect(scope().hasAttribute("data-theme")).toBe(false);
  });

  it("renders the server's preference on first paint, so there is no flash", () => {
    const day = renderToString(<ImmersiveScope serverValue="day">Studio</ImmersiveScope>);
    expect(day).not.toContain("data-theme");
    const system = renderToString(<ImmersiveScope serverValue="system">Studio</ImmersiveScope>);
    expect(system).toContain('data-theme="night"');
  });
});
