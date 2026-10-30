import type { Metadata } from "next";
import { DuetPrototype } from "./duet-prototype-host";

// Live mock prototype (spec §6.7 "Live mock", §6.10 J, §16 Phase 0.5): the duet stage with a
// scripted interviewer and sample answers from a fictional applicant at a fictional school.

export const metadata: Metadata = { title: "Live mock" };

export default function DuetPrototypePage() {
  return <DuetPrototype />;
}
