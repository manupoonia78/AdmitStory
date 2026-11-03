"use client";

// The intake's record button, loaded on first press (spec §6.11): the voice client is the
// heaviest thing this screen can need, and the questions can all be typed.

import { Button } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { useState } from "react";

const DetailDictation = dynamic(
  () => import("../dossier/detail-dictation").then((m) => m.DetailDictation),
  {
    ssr: false,
    loading: () => (
      <Button variant="secondary" loading disabled>
        Say this answer
      </Button>
    ),
  },
);

export function IntakeRecordHost({
  onDictated,
}: {
  onDictated: (text: string, seconds: number, language: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed)
    return (
      <Button variant="secondary" onClick={() => setArmed(true)}>
        Say this answer
      </Button>
    );
  return (
    <DetailDictation
      label="Say this answer"
      onDictated={(answer) => onDictated(answer.text, answer.seconds, answer.language ?? "en")}
    />
  );
}
