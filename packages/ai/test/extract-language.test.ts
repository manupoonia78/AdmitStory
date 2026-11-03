import { describe, expect, it } from "vitest";
import { createFilePromptSource, loadPrompt } from "../src/prompts/registry";
import { TASKS } from "../src/tasks";

// Phase 2, §7.5: a non-English answer is extracted into English dossier fields while its golden
// lines stay in the original language with an English rendering.

const extract = TASKS["studio.extract"];
const messageText = (language: string | null) =>
  extract
    .buildMessages(
      extract.input.parse({ text: "Trabajé toda la noche.", chapter: "work", language }),
    )
    .map((turn) => (typeof turn.content === "string" ? turn.content : JSON.stringify(turn.content)))
    .join("\n");

describe("studio.extract and the answer's language", () => {
  it("tells the Extractor when an answer is not in English", () => {
    expect(messageText("es")).toContain("Language of the answer: es (not English");
  });

  it("adds nothing for English or an unknown language, so English requests are unchanged", () => {
    expect(messageText(null)).not.toContain("Language of the answer");
    expect(messageText("en-GB")).not.toContain("Language of the answer");
    expect(messageText(null)).toBe(
      extract
        .buildMessages(extract.input.parse({ text: "Trabajé toda la noche.", chapter: "work" }))
        .map((turn) =>
          typeof turn.content === "string" ? turn.content : JSON.stringify(turn.content),
        )
        .join("\n"),
    );
  });

  it("serves prompt v2, which keeps golden lines in the original with an English rendering", async () => {
    const prompt = await loadPrompt(createFilePromptSource(), "studio.extract");
    expect(prompt.version).toBe(2);
    expect(prompt.body).toMatch(/Golden lines are the exception: copy each one verbatim/);
    expect(prompt.body).toMatch(/English rendering of it in `english`/);
  });
});
