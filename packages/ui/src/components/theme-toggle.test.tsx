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
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(readThemeCookie(document.cookie)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: "Match system" }));
    expect(readThemeCookie(document.cookie)).toBe("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
