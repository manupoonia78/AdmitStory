// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_IDENTITY } from "../voiceprint/params";
import {
  DuetCaptions,
  DuetControls,
  DuetHeader,
  DuetStage,
  type DuetStageProps,
} from "./duet-stage";

// The real Voiceprint is tested in ../voiceprint; here only the props the stage passes matter.
vi.mock("../voiceprint/voiceprint", () => ({
  Voiceprint: (props: { label: string; tone?: string; mood?: string }) => (
    <div role="img" aria-label={props.label} data-tone={props.tone} data-vp-mood={props.mood} />
  ),
}));

const signal = () => ({ current: { amplitude: 0.6, centroid: 0.4, pitchDelta: 0.1 } });

function stage(props: Partial<DuetStageProps> = {}) {
  return render(
    <DuetStage
      you={{ identity: DEFAULT_IDENTITY, signal: signal(), label: "Your Voiceprint" }}
      interviewer={{
        identity: { ...DEFAULT_IDENTITY, avgPitchHz: 120 },
        signal: signal(),
        label: "Interviewer's Voiceprint",
      }}
      speaker="interviewer"
      {...props}
    />,
  );
}

const moodOf = (container: HTMLElement, party: "you" | "interviewer") =>
  container.querySelector(`[data-party='${party}']`)?.getAttribute("data-mood");

describe("DuetStage", () => {
  it("shows both Voiceprints, named, in a labelled region", () => {
    stage();
    const region = screen.getByRole("region", { name: "Live mock" });
    expect(within(region).getByRole("img", { name: "Your Voiceprint" })).toBeTruthy();
    expect(within(region).getByRole("img", { name: "Interviewer's Voiceprint" })).toBeTruthy();
  });

  it("draws the interviewer in silver and you in your hue", () => {
    const { container } = stage();
    const interviewer = container.querySelector("[data-party='interviewer'] [data-tone]");
    const you = container.querySelector("[data-party='you'] [data-tone]");
    expect(interviewer?.getAttribute("data-tone")).toBe("silver");
    expect(you?.getAttribute("data-tone")).toBe("voice");
  });

  it("lets each form respond to whoever is speaking", () => {
    const { container, rerender } = stage({ speaker: "interviewer" });
    expect(moodOf(container, "interviewer")).toBe("speaking");
    expect(moodOf(container, "you")).toBe("listening");
    // The speaker comes forward.
    const forward = container.querySelector<HTMLElement>("[data-party='interviewer']")!;
    const back = container.querySelector<HTMLElement>("[data-party='you']")!;
    expect(forward.style.transform).toBe("none");
    expect(back.style.transform).toContain("scale(0.9)");

    rerender(
      <DuetStage
        you={{ identity: DEFAULT_IDENTITY, label: "Your Voiceprint" }}
        interviewer={{ identity: DEFAULT_IDENTITY, label: "Interviewer's Voiceprint" }}
        speaker="you"
      />,
    );
    expect(moodOf(container, "you")).toBe("speaking");
    expect(moodOf(container, "interviewer")).toBe("listening");
  });

  it("rests both forms while paused and says so", () => {
    const { container } = stage({ paused: true, status: "Paused" });
    expect(moodOf(container, "you")).toBe("idle");
    expect(moodOf(container, "interviewer")).toBe("idle");
    expect(screen.getByRole("status").textContent).toBe("Paused");
  });

  it("renders the header, captions and controls it is given", () => {
    stage({
      header: <DuetHeader title="Northfield mock" details={["Admissions officer"]} elapsedMs={0} />,
      captions: <DuetCaptions interviewer="Walk me through your resume." you="Sure." />,
      controls: <button type="button">End</button>,
    });
    expect(screen.getByRole("heading", { level: 1, name: "Northfield mock" })).toBeTruthy();
    expect(screen.getByText("Walk me through your resume.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "End" })).toBeTruthy();
  });
});

describe("DuetHeader", () => {
  it("keeps persona, format and length as separate items, with a running timer", () => {
    render(
      <DuetHeader
        title="Northfield mock"
        details={["Admissions officer", "File-read", "30 min"]}
        elapsedMs={18 * 60_000 + 42_000}
      />,
    );
    const details = screen.getByRole("list", { name: "About this mock" });
    expect(
      within(details)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Admissions officer", "File-read", "30 min"]);
    const timer = screen.getByRole("timer");
    expect(timer.textContent).toBe("18:42");
    expect(timer.getAttribute("datetime")).toBe("PT18M42S");
    expect(timer.parentElement?.textContent).toBe("Time elapsed: 18:42");
  });
});

describe("DuetCaptions", () => {
  it("labels the lines for screen readers and colours them by speaker", () => {
    const { container } = render(<DuetCaptions interviewer="Why now?" you="Honestly," />);
    const [theirs, yours] = container.querySelectorAll("p");
    expect(theirs!.textContent).toBe("Interviewer: Why now?");
    expect(theirs!.className).toContain("text-silver");
    expect(yours!.textContent).toBe("YouHonestly,");
    expect(yours!.className).toContain("text-voice");
  });

  it("keeps its space when captions are off", () => {
    const { container } = render(<DuetCaptions interviewer="Why now?" hidden />);
    const captions = container.firstElementChild!;
    expect(captions.getAttribute("data-captions")).toBe("off");
    expect(captions.className).toContain("invisible");
  });
});

describe("DuetControls", () => {
  function controls(overrides: Partial<Parameters<typeof DuetControls>[0]> = {}) {
    const props = {
      muted: false,
      onMutedChange: vi.fn(),
      captionsOn: true,
      onCaptionsChange: vi.fn(),
      paused: false,
      onPausedChange: vi.fn(),
      waiting: false,
      onWaitingChange: vi.fn(),
      onEnd: vi.fn(),
      ...overrides,
    };
    render(<DuetControls {...props} />);
    return props;
  }

  it("offers only Mute, Captions on, Pause, Need a moment and End", () => {
    controls();
    const group = screen.getByRole("group", { name: "Mock controls" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Mute", "Captions on", "Pause", "Need a moment", "End"]);
  });

  it("states each toggle with aria-pressed and flips it on press", () => {
    const props = controls({ muted: true });
    const mute = screen.getByRole("button", { name: "Mute" });
    expect(mute.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Captions on" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Pause" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    fireEvent.click(mute);
    expect(props.onMutedChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Need a moment" }));
    expect(props.onWaitingChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(props.onPausedChange).toHaveBeenCalledWith(true);
  });

  it("ends the mock", () => {
    const props = controls();
    const end = screen.getByRole("button", { name: "End" });
    expect(end.hasAttribute("aria-pressed")).toBe(false);
    fireEvent.click(end);
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });
});
