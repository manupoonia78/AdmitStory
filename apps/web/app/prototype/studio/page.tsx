import type { Metadata } from "next";
import { StudioPrototype } from "./studio-prototype-host";

// Story Studio prototype (spec §6.7 Story Studio, §6.10 B, §16 Phase 0.5): speaking to your
// Voiceprint and the story-capture flight, on fake data for a fictional applicant. "Play sample
// answer" runs the whole moment without a microphone, for screen-recording reviews.

export const metadata: Metadata = { title: "Story Studio" };

export default function StudioPrototypePage() {
  return <StudioPrototype />;
}
