import next from "eslint-config-next";
import tseslint from "typescript-eslint";

// Spec §0 non-negotiables, enforced mechanically:
//  - model IDs appear only in packages/ai/src/routing.ts
//  - the Anthropic SDK is imported only inside packages/ai (feature code uses ai.run)
const MODEL_ID = "/\\bclaude-(opus|sonnet|haiku|fable|mythos)-[0-9]/";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "**/migrations/**",
      "fixtures/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${MODEL_ID}]`,
          message: "Model IDs live only in packages/ai/src/routing.ts.",
        },
        {
          selector: `TemplateElement[value.raw=${MODEL_ID}]`,
          message: "Model IDs live only in packages/ai/src/routing.ts.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
              message: "Use ai.run() from @admitstory/ai (spec §8.4).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/ai/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["packages/ai/src/routing.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Tests, the fixtures they share, and the fixed sample inputs the recorders and tests share.
    files: ["**/*.test.ts", "**/*.test.tsx", "apps/web/test/**", "packages/ai/scripts/samples/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  ...next.map((c) => ({
    ...c,
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}", "packages/emails/**/*.{ts,tsx}"],
  })),
  {
    settings: { next: { rootDir: "apps/web" } },
    // App Router only; there is no pages/ directory.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
);
