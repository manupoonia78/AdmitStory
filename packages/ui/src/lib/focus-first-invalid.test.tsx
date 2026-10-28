// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "../components/text-field";
import { focusFirstInvalid } from "./focus-first-invalid";

describe("focusFirstInvalid", () => {
  it("focuses the first invalid field in document order", () => {
    const { container } = render(
      <form>
        <TextField label="Name" />
        <TextField label="Email" error="Enter an email address, like name@example.com." />
        <TextField label="School" error="Choose a school." />
      </form>,
    );
    const focused = focusFirstInvalid(container.querySelector("form"));
    expect(focused).toBe(screen.getByLabelText("Email"));
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
  });

  it("skips disabled, hidden and unfocusable invalid elements", () => {
    const { container } = render(
      <form>
        <TextField label="Disabled" error="Ignored." disabled />
        <div hidden>
          <TextField label="Hidden" error="Ignored." />
        </div>
        <div aria-invalid="true">Not focusable</div>
        <TextField label="Reachable" error="Fill this in." />
      </form>,
    );
    expect(focusFirstInvalid(container.querySelector("form"))).toBe(
      screen.getByLabelText("Reachable"),
    );
  });

  it("returns null and leaves focus alone when nothing is invalid", () => {
    const { container } = render(
      <form>
        <TextField label="Name" />
      </form>,
    );
    expect(focusFirstInvalid(container.querySelector("form"))).toBeNull();
    expect(focusFirstInvalid(null)).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
