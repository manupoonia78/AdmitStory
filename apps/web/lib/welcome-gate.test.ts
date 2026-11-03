import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The welcome gate (18+ and the integrity commitments) has to hold on every request, not only in
// the (app) layout: Next renders a layout and its page in parallel, and server actions never run
// the layout. So every page and every server action under app/(app) checks it itself.

const APP_GROUP = fileURLToPath(new URL("../app/(app)", import.meta.url));

// Actions that must work before the gate is passed.
const UNGATED_ACTIONS = new Set(["signOut"]);

function filesNamed(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesNamed(path, name);
    return entry.name === name ? [path] : [];
  });
}

describe("welcome gate coverage in app/(app)", () => {
  const pages = filesNamed(APP_GROUP, "page.tsx");

  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of pages) {
    it(`${relative(APP_GROUP, file)} calls requireOnboardedUser()`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/await requireOnboardedUser\(\)/);
      expect(source).not.toMatch(/\brequire(AppUser|Session)\(/);
    });
  }

  for (const file of filesNamed(APP_GROUP, "actions.ts")) {
    const source = readFileSync(file, "utf8");
    const actions = [
      ...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g),
    ];

    it(`${relative(APP_GROUP, file)} exports server actions`, () => {
      expect(source).toMatch(/^"use server";/);
      expect(actions.length).toBeGreaterThan(0);
    });

    for (const [, name, body] of actions) {
      if (!name || UNGATED_ACTIONS.has(name)) continue;
      it(`${relative(APP_GROUP, file)} ${name}() starts with requireOnboardedUser("action")`, () => {
        expect(body?.trimStart()).toMatch(/^await requireOnboardedUser\("action"\);/);
      });
    }
  }
});
