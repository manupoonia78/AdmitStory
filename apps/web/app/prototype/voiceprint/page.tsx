import type { Metadata } from "next";
import { VoiceprintLab } from "./voiceprint-lab-host";

// The Voiceprint review lab (spec §6.2, §6.11): live microphone input, the three-minute identity
// sample, the writing path, every hue and every performance tier, on a fictional applicant.

export const metadata: Metadata = { title: "Voiceprint" };

export default function VoiceprintPrototypePage() {
  return <VoiceprintLab />;
}
