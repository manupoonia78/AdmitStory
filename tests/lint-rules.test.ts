import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Spec §0 non-negotiables are enforced by ESLint; this proves the rules fire where they should.
const root = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({ cwd: root });

// Assembled at runtime so this file does not itself trip the rule it tests.
const id = (family: string) => ["claude", family, "5", "5"].join("-");
const MODEL_LITERAL = `export const model = "${id("sonnet")}";\n`;
const SDK_IMPORT =
  'import Anthropic from "@anthropic-ai/sdk";\nexport const client = new Anthropic();\n';

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("lint rules (spec §0)", () => {
  it("rejects a model ID literal outside routing.ts", async () => {
    expect(await ruleIds(MODEL_LITERAL, "apps/web/x.ts")).toContain("no-restricted-syntax");
    expect(
      await ruleIds(`export const m = \`${id("opus")}\`;\n`, "packages/db/src/x.ts"),
    ).toContain("no-restricted-syntax");
  });

  it("allows model IDs in packages/ai/src/routing.ts", async () => {
    expect(await ruleIds(MODEL_LITERAL, "packages/ai/src/routing.ts")).not.toContain(
      "no-restricted-syntax",
    );
  });

  it("rejects importing the Anthropic SDK outside packages/ai", async () => {
    expect(await ruleIds(SDK_IMPORT, "apps/web/x.ts")).toContain("no-restricted-imports");
    expect(
      await ruleIds('export * from "@anthropic-ai/sdk/helpers/zod";\n', "packages/kb/src/x.ts"),
    ).toContain("no-restricted-imports");
    expect(await ruleIds(SDK_IMPORT, "packages/ai/src/x.ts")).not.toContain(
      "no-restricted-imports",
    );
  });
});
