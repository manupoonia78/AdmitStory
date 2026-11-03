import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// usePerformanceTier points detect-gpu at /detect-gpu (tier.ts), so GPU detection never calls a
// third-party CDN. apps/web serves a copy of the package's benchmark data from public/detect-gpu;
// this keeps that copy in step when detect-gpu is upgraded. To refresh it:
//   cp node_modules/detect-gpu/dist/benchmarks/*.json apps/web/public/detect-gpu/
//   pnpm exec prettier --write apps/web/public/detect-gpu

const here = dirname(fileURLToPath(import.meta.url));
const served = join(here, "../../../../apps/web/public/detect-gpu");
const packaged = join(dirname(createRequire(import.meta.url).resolve("detect-gpu")), "benchmarks");

const jsonFiles = (directory: string) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();

describe("detect-gpu benchmark data served by apps/web", () => {
  it("has every file the package ships", () => {
    expect(jsonFiles(served)).toEqual(jsonFiles(packaged));
  });

  it("holds the same data as the installed version", () => {
    for (const name of jsonFiles(packaged)) {
      const read = (directory: string) => JSON.parse(readFileSync(join(directory, name), "utf8"));
      expect(read(served), name).toEqual(read(packaged));
    }
  });
});
