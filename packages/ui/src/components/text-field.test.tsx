// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("labels the input and reads the hint with it", () => {
    render(<TextField label="Email" hint="We send a sign-in link here." type="email" />);
    const input = screen.getByLabelText("Email");
    const hint = screen.getByText("We send a sign-in link here.");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("marks the field invalid and reads the error after the hint", () => {
    render(
      <TextField
        label="Email"
        hint="We send a sign-in link here."
        error="Enter an email address, like name@example.com."
      />,
    );
    const input = screen.getByLabelText("Email");
    const hint = screen.getByText("We send a sign-in link here.");
    const error = screen.getByText("Enter an email address, like name@example.com.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(`${hint.id} ${error.closest("p")?.id}`);
  });

  it("adds the error into a live region that was already in the DOM, so it is announced", () => {
    const { rerender } = render(<TextField label="Email" />);
    const regions = document.querySelectorAll('[aria-live="polite"]');
    expect(regions).toHaveLength(1);
    const region = regions[0];
    expect(region?.textContent).toBe("");

    rerender(<TextField label="Email" error="Enter an email address, like name@example.com." />);
    // The same node, not a new one: a live region created with its text is often not read.
    expect(document.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region?.textContent).toBe("Enter an email address, like name@example.com.");
    const error = screen.getByText("Enter an email address, like name@example.com.").closest("p");
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBe(error?.id);
  });

  it("keeps a caller's own aria-describedby", () => {
    render(<TextField label="Intake year" aria-describedby="year-note" />);
    expect(screen.getByLabelText("Intake year").getAttribute("aria-describedby")).toBe("year-note");
  });
});
