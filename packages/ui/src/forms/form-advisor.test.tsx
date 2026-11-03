// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormAdvisor, type FormAdvisorProps } from "./form-advisor";
import type { FormAdvisorItem } from "./form-item";
import { entryCount, limitDescription, overCountNote } from "./form-text";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

afterEach(() => {
  motionPreference.reduced = false;
});

const item = (over: Partial<FormAdvisorItem> & Pick<FormAdvisorItem, "id">): FormAdvisorItem => ({
  candidate: `Candidate ${over.id}`,
  cites: ["F1"],
  recommendation: "include",
  combine_with: null,
  move_to: null,
  reason: `Reason for ${over.id}.`,
  entry: { text: `Entry for ${over.id}`, sources: ["F1"] },
  stronger: [],
  needs: [],
  citations: [{ code: "F1", label: "Ran the Saturday coding class", excerpt: "every Saturday" }],
  userText: null,
  ...over,
});

const ITEMS: FormAdvisorItem[] = [
  item({ id: "i1", candidate: "Hospital volunteering", recommendation: "include" }),
  item({
    id: "i2",
    candidate: "Saturday coding class",
    recommendation: "lead_with",
    entry: { text: "Founded a free coding class; 40 teens", sources: ["F1"] },
    stronger: ["Add your role and a number"],
    needs: [{ question: "How many students finished the course?", approx_words: 5 }],
  }),
  item({
    id: "i3",
    candidate: "Chess club",
    recommendation: "leave_out",
    entry: null,
    reason: "It repeats Essay 1 and adds no new trait.",
  }),
  item({
    id: "i4",
    candidate: "Park clean-up",
    recommendation: "move_to_essay",
    move_to: "essay-2",
    entry: null,
  }),
  item({ id: "i5", candidate: "Food bank", recommendation: "combine_with", combine_with: "i1" }),
];

const SECTION: FormAdvisorProps["section"] = {
  key: "activities",
  label: "Extracurricular activities",
  rule: { unit: "characters", limit: 40, spaces: true },
  itemCountMax: 3,
  guidance: [
    {
      text: "List activities in order of importance to you.",
      source: { id: "src1", label: "Application instructions", verifiedAt: "2026-09-12" },
    },
  ],
};

function renderAdvisor(props: Partial<FormAdvisorProps> = {}) {
  const handlers = { onEditEntry: vi.fn(), onCopy: vi.fn(), onRefresh: vi.fn() };
  const view = render(
    <FormAdvisor
      section={SECTION}
      mode="draft"
      items={ITEMS}
      couldStillDo={[
        {
          text: "Finish the data course you started",
          why: "It backs your analytics goal.",
          time: "About 2 weeks",
        },
      ]}
      consistency={[]}
      stale={false}
      deliverableLabel={(key) => (key === "essay-2" ? "Essay 2" : key)}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

describe("form text", () => {
  it("describes the limits and counts by the school's rule, emoji and curly quotes as one", () => {
    expect(limitDescription(3, { unit: "characters", limit: 300 })).toBe(
      "Up to 3 entries, 300 characters each",
    );
    expect(limitDescription(1, { unit: "words", limit: 50 })).toBe("One entry, up to 50 words");
    expect(limitDescription(null, null)).toBeNull();
    const text = "I “led” 12 people 👩‍👩‍👧 to win";
    expect(entryCount(text, { unit: "characters", limit: 40 })).toBe(26);
    expect(entryCount(text, { unit: "characters", limit: 40, spaces: false })).toBe(20);
    expect(entryCount(text, { unit: "words", limit: 40 })).toBe(7);
    expect(overCountNote(4, 3)).toBe("4 entries; the form takes 3.");
    expect(overCountNote(3, 3)).toBeNull();
  });
});

describe("FormAdvisor", () => {
  it("shows the section, its limits and the pack guidance with source and date", () => {
    renderAdvisor();
    expect(
      screen.getByRole("heading", { level: 1, name: "Extracurricular activities" }),
    ).toBeTruthy();
    expect(screen.getByText("Up to 3 entries, 40 characters each")).toBeTruthy();
    expect(screen.getByText(/Application instructions\. Verified/).textContent).toContain(
      "12 Sep 2026",
    );
  });

  it("puts the candidates in recommendation lanes, in order, each with its reason", () => {
    const { container } = renderAdvisor();
    const lanes = [...container.querySelectorAll("[data-lane]")].map((lane) =>
      lane.getAttribute("data-lane"),
    );
    expect(lanes).toEqual(["lead_with", "include", "combine_with", "move_to_essay", "leave_out"]);
    expect(screen.getByRole("heading", { level: 2, name: "Lead with (1)" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Move to an essay (1)" })).toBeTruthy();
    for (const it of ITEMS) expect(screen.getByText(it.reason)).toBeTruthy();
    expect(screen.getByText("Combine with:").textContent).toContain("Hospital volunteering");
    expect(screen.getByText("Move to:").textContent).toContain("Essay 2");
    expect(screen.getByText("Add your role and a number")).toBeTruthy();
    expect(
      screen.getByText(/How many students finished the course\? About 5 words\./),
    ).toBeTruthy();
    expect(screen.getByText("What you could still do")).toBeTruthy();
    expect(screen.getByText("About 2 weeks")).toBeTruthy();
  });

  it("counts each entry live by the rule, characters with spaces, an emoji and curly quotes", () => {
    const { onEditEntry } = renderAdvisor();
    const lead = document.querySelector('[data-item="i2"]') as HTMLElement;
    const field = within(lead).getByRole("textbox", { name: "Entry" }) as HTMLTextAreaElement;
    expect(field.value).toBe("Founded a free coding class; 40 teens");
    fireEvent.change(field, { target: { value: "I “led” 12 people 👩‍👩‍👧 to win" } });
    expect(onEditEntry).toHaveBeenCalledWith("i2", "I “led” 12 people 👩‍👩‍👧 to win");
    expect(lead.textContent).toContain("26 / 40 characters");
    fireEvent.change(field, {
      target: { value: "I “led” 12 people 👩‍👩‍👧 to win the regional final" },
    });
    expect(lead.textContent).toContain("45 / 40 characters");
    expect(lead.textContent).toContain("5 characters over");
  });

  it("copies the entry for the portal with curly quotes straightened", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { onCopy } = renderAdvisor();
    const lead = document.querySelector('[data-item="i2"]') as HTMLElement;
    fireEvent.change(within(lead).getByRole("textbox"), { target: { value: "I “led” it  " } });
    await act(async () => {
      fireEvent.click(within(lead).getByRole("button", { name: "Copy for portal" }));
    });
    expect(writeText).toHaveBeenCalledWith('I "led" it');
    expect(onCopy).toHaveBeenCalledWith("i2", 'I "led" it');
  });

  it("in coach mode writes nothing: the applicant's material and an empty field", () => {
    renderAdvisor({
      mode: "coach",
      policyNote: "Stanford doesn't allow AI-written answers, so you write these entries yourself.",
    });
    expect(screen.queryByDisplayValue(/Founded a free coding class/)).toBeNull();
    expect(screen.queryByText(/Entry for i1/)).toBeNull();
    expect(screen.getByText(/Stanford doesn't allow AI-written answers/)).toBeTruthy();
    const lead = document.querySelector('[data-item="i2"]') as HTMLElement;
    expect(within(lead).getByText("Your material")).toBeTruthy();
    const field = within(lead).getByRole("textbox", {
      name: "Write your entry",
    }) as HTMLTextAreaElement;
    expect(field.value).toBe("");
    expect(lead.textContent).toContain("0 / 40 characters");
  });

  it("notes when the advice puts more entries in the form than it takes", () => {
    renderAdvisor({ section: { ...SECTION, itemCountMax: 2 } });
    expect(screen.getByText("3 entries; the form takes 2.")).toBeTruthy();
  });

  it("offers to refresh stale advice and shows consistency findings first", () => {
    const { onRefresh, container } = renderAdvisor({
      stale: true,
      consistency: [
        {
          id: "f1",
          rule_id: "consistency.number",
          severity: "must",
          subject: "number",
          what: "Students taught",
          values: [
            {
              said: "40",
              docId: "activities",
              docKind: "form",
              docLabel: "Form: Activities",
              ref: "activities/i2",
              excerpt: "40 teens",
            },
            {
              said: "45",
              docId: "resume",
              docKind: "resume",
              docLabel: "Resume",
              ref: "b2",
              excerpt: "45 students",
            },
          ],
          expected: null,
          explanation: 'Your form says "40"; your resume says "45".',
          fix_hint: "Pick one number.",
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh the advice" }));
    expect(onRefresh).toHaveBeenCalled();
    const mustFix = screen.getByText("Students taught");
    const firstLane = container.querySelector("[data-lane]") as HTMLElement;
    expect(mustFix.compareDocumentPosition(firstLane) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders the same lanes under reduced motion", () => {
    motionPreference.reduced = true;
    const { container } = renderAdvisor();
    expect(container.querySelectorAll("[data-hero-card]")).toHaveLength(ITEMS.length);
  });
});
