// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusLabel, type StatusTone } from "./status-label";

const CASES: [StatusTone, string, string][] = [
  ["verified", "Confirmed", "text-verified"],
  ["needs", "Needs you", "text-needs"],
  ["risk", "Must fix", "text-risk"],
  ["neutral", "Draft", "text-slate"],
];

describe("StatusLabel", () => {
  it.each(CASES)(
    "%s carries its meaning in text and an icon, not colour alone",
    (tone, text, colourClass) => {
      const { container } = render(<StatusLabel tone={tone}>{text}</StatusLabel>);
      const label = screen.getByText(text);
      expect(label).toBeTruthy();
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain(colourClass);
      expect(root.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    },
  );
});
