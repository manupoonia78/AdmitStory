// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceNotice } from "./voice-notice";

const ASK = {
  tone: "info" as const,
  message: "Admitstory needs your microphone to hear your answers.",
};

describe("VoiceNotice", () => {
  it("puts the message in a polite live region that stays mounted while empty", () => {
    const { rerender } = render(<VoiceNotice notice={null} />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");
    rerender(<VoiceNotice notice={ASK} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe(ASK.message);
  });

  it("keeps the action labels out of the announcement", () => {
    render(
      <VoiceNotice
        notice={ASK}
        actions={[{ label: "Allow microphone", onClick: () => {}, primary: true }]}
      />,
    );
    expect(screen.getByRole("status").textContent).not.toContain("Allow microphone");
    expect(screen.getByRole("button", { name: "Allow microphone" })).toBeTruthy();
  });

  it("runs each action, the primary one filled and the rest outlined", () => {
    const allow = vi.fn();
    const write = vi.fn();
    render(
      <VoiceNotice
        notice={ASK}
        actions={[
          { label: "Allow microphone", onClick: allow, primary: true },
          { label: "Write instead", onClick: write },
        ]}
      />,
    );
    const allowButton = screen.getByRole("button", { name: "Allow microphone" });
    const writeButton = screen.getByRole("button", { name: "Write instead" });
    expect(allowButton.className).toContain("bg-signal");
    expect(writeButton.className).toContain("border-control");
    fireEvent.click(allowButton);
    fireEvent.click(writeButton);
    expect(allow).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
  });

  it("shows no actions without a notice", () => {
    render(<VoiceNotice notice={null} actions={[{ label: "Try again", onClick: () => {} }]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("pairs every tone with an icon, never colour alone", () => {
    for (const tone of ["info", "warning", "problem"] as const) {
      const { container, unmount } = render(<VoiceNotice notice={{ tone, message: "Heard." }} />);
      const line = container.querySelector(`[data-tone='${tone}']`)!;
      expect(line.querySelector("svg")).toBeTruthy();
      unmount();
    }
  });
});
