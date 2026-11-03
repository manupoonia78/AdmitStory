import type { Metadata } from "next";
import { WorkspacePrototype } from "./workspace-prototype-host";

// Workspace prototype (spec §6.7 "Your words, lit", §16 Phase 0.5): one fake essay with the
// your-words glow, a NEED chip and prepared Refine results that morph in place.

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacePrototypePage() {
  return <WorkspacePrototype />;
}
