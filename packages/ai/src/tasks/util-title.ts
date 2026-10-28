import { untrustedBlock } from "../request";
import { UtilTitleInput, UtilTitleOutput } from "../schemas/util-title";
import { defineTask } from "./define";

export const utilTitle = defineTask({
  name: "util.title",
  agent: "util.title",
  input: UtilTitleInput,
  output: UtilTitleOutput,
  outputName: "UtilTitleOutput",
  buildMessages: (input) => [
    { role: "user", content: `Title this passage.\n\n${untrustedBlock("passage", input.text)}` },
  ],
});
