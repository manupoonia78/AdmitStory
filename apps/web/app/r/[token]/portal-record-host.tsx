"use client";

import { Button, PORTAL_COPY, type DictatedNote } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { useState } from "react";

// The record button for a note, loaded on first press (spec §6.11): the voice client is the
// heaviest thing the portal can need, and most recommenders will type. Until it is pressed, this
// is one button and nothing else.

const PortalRecord = dynamic(() => import("./portal-record").then((m) => m.PortalRecord), {
  ssr: false,
  loading: () => (
    <Button variant="secondary" loading disabled>
      {PORTAL_COPY.recordNote}
    </Button>
  ),
});

export function PortalRecordHost({
  endpoint,
  onDictated,
}: {
  /** POST /api/r/<token>/stt: the invite's own token endpoint, never the applicant's. */
  endpoint: string;
  onDictated: (note: DictatedNote) => void;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed)
    return (
      <Button variant="secondary" onClick={() => setArmed(true)}>
        {PORTAL_COPY.recordNote}
      </Button>
    );
  return <PortalRecord endpoint={endpoint} onDictated={onDictated} autoStart />;
}
