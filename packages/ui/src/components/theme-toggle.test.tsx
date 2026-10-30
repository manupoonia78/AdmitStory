// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readThemeCookie } from "../theme-preference";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("offers the three choices as a radio group, defaulting to the system", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    const system = screen.getByRole("radio", { name: "Match system" });
    expect(system.getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("writes the cookie and applies data-theme without a reload", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "Night" }));
    expect(readThemeCookie(document.cookie)).toBe("night");
    expect(document.documentElement.getAttribute("data-theme")).toBe("night");
    expect(screen.getByRole("radio", { name: "Night" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: "Match system" }));
    expect(readThemeCookie(document.cookie)).toBe("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("moves and chooses with the arrow keys, wrapping around the group", () => {
    render(<ThemeToggle />);
    const system = screen.getByRole("radio", { name: "Match system" });
    // Roving tabindex: the chosen option is the group's only tab stop.
    expect(system.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("radio", { name: "Night" }).getAttribute("tabindex")).toBe("-1");

    system.focus();
    fireEvent.keyDown(system, { key: "ArrowRight" });
    const night = screen.getByRole("radio", { name: "Night" });
    expect(night.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(night);

    fireEvent.keyDown(night, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Match system" }).getAttribute("aria-checked")).toBe(
      "true",
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Match system" }), { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Day" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Day" }), { key: "Home" });
    expect(screen.getByRole("radio", { name: "Match system" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("keeps every option named when compact hides the labels visually", () => {
    render(<ThemeToggle compact />);
    for (const name of ["Match system", "Night", "Day"]) {
      expect(screen.getByRole("radio", { name })).toBeTruthy();
    }
  });
});
