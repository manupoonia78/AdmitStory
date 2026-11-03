import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "@admitstory/shared";
import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "../src/prompts/front-matter";
import {
  createFilePromptSource,
  loadPrompt,
  parsePromptFile,
  renderPrompt,
} from "../src/prompts/registry";

const file = (header: string, body = "Body for {{APP_NAME}}.") => `---\n${header}\n---\n${body}\n`;

function promptDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "prompts-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

describe("prompt front matter", () => {
  it("parses scalars, quoted values, inline lists and block lists", () => {
    const { meta, body } = parseFrontMatter(
      file(
        'agent: kit.draft\nversion: 3\nnotes: "Uses: colons"\ncanon: [story-craft, CRAFT-3]\nextra:\n  - a\n  - "b"',
      ),
      "x.md",
    );
    expect(meta).toEqual({
      agent: "kit.draft",
      version: "3",
      notes: "Uses: colons",
      canon: ["story-craft", "CRAFT-3"],
      extra: ["a", "b"],
    });
    expect(body).toBe("Body for {{APP_NAME}}.");
  });

  it("splits canon refs into files and rule IDs and rejects unknown keys", () => {
    const t = parsePromptFile(
      file("agent: kit.draft\nversion: 2\noutput: Draft\ncanon:\n  - story-craft\n  - TRUTH-01"),
      "x.md",
    );
    expect(t).toMatchObject({
      agent: "kit.draft",
      version: 2,
      output: "Draft",
      canonFiles: ["story-craft"],
      canonRules: ["TRUTH-01"],
      notes: "",
    });
    expect(() =>
      parsePromptFile(file("agent: kit.draft\nversion: 1\noutput: Draft\nmodel: opus"), "x.md"),
    ).toThrow(/invalid prompt header/);
    expect(() => parsePromptFile("no header", "x.md")).toThrow(/missing front matter/);
  });
});

describe("prompt registry", () => {
  const dir = promptDir({
    "kit.draft/v1.md": file("agent: kit.draft\nversion: 1\noutput: Draft\ncanon: []", "One"),
    "kit.draft/v2.md": file(
      "agent: kit.draft\nversion: 2\noutput: Draft\ncanon: []",
      "Two {{school}}",
    ),
    "kit.bad/v1.md": file("agent: kit.other\nversion: 1\noutput: Draft"),
  });
  const source = createFilePromptSource(dir);

  it("returns the highest version unless a version is requested", async () => {
    expect((await loadPrompt(source, "kit.draft")).version).toBe(2);
    expect((await loadPrompt(source, "kit.draft", 1)).body).toBe("One");
    await expect(loadPrompt(source, "kit.draft", 7)).rejects.toThrow(/does not exist/);
    await expect(loadPrompt(source, "kit.missing")).rejects.toThrow(/No prompt found/);
  });

  it("checks that the header agent matches the directory", async () => {
    await expect(source.versions("kit.bad")).rejects.toThrow(/must be "kit.bad"/);
  });

  it("interpolates APP_NAME and variables, and throws on a missing variable", async () => {
    const v2 = await loadPrompt(source, "kit.draft");
    expect(renderPrompt(v2, { school: "Example School" })).toBe("Two Example School");
    expect(() => renderPrompt(v2)).toThrow(/missing variables: school/);
    expect(renderPrompt({ agent: "a.b", version: 1, body: "Hi from {{ APP_NAME }}" })).toBe(
      `Hi from ${APP_NAME}`,
    );
  });

  it("loads the shipped util.title prompt", async () => {
    const t = await loadPrompt(createFilePromptSource(), "util.title");
    expect(t).toMatchObject({ agent: "util.title", version: 1, output: "UtilTitleOutput" });
    const text = renderPrompt(t);
    expect(text).toContain(APP_NAME);
    expect(text).toContain("untrusted_input");
    expect(text).not.toMatch(/\{\{/);
  });
});
