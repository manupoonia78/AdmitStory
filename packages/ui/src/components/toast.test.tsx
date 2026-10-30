// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";

function SaveName({ onUndo = vi.fn() }: { onUndo?: () => void }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: "Name saved",
          action: { label: "Undo", altText: "Rename it again in Settings", onAction: onUndo },
        })
      }
    >
      Save name
    </button>
  );
}

describe("ToastProvider", () => {
  // The stack is a dynamic import; warm it once so the first toast is not racing a cold transform
  // under a full parallel run.
  beforeAll(async () => {
    await import("../shell/toast-stack");
  }, 60_000);

  it("keeps the toast stack out of the first render", () => {
    render(
      <ToastProvider>
        <SaveName />
      </ToastProvider>,
    );
    // No Radix viewport (a "Notification" region) until the page is idle or a toast is asked for.
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("loads the stack on the first toast and shows it, named for the action", async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <SaveName onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Name saved", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Notification/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("loads the stack when the page is idle", async () => {
    vi.useFakeTimers();
    try {
      // jsdom has no requestIdleCallback, so the 2 s fallback applies.
      render(
        <ToastProvider>
          <p>Page</p>
        </ToastProvider>,
      );
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(
      await screen.findByRole("region", { name: /Notification/ }, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("throws a clear error outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SaveName />)).toThrow("useToast must be used inside <ToastProvider>.");
    vi.restoreAllMocks();
  });
});
