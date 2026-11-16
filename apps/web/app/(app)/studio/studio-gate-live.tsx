"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StudioGate, type StudioGateProps } from "./studio-gate";

// The halfway prompt when the last free answer lands mid-session. It shows at once with what the
// screen already has, then asks the server for the page again: the limit is reached, so the page
// answers with the prompt itself, counting the stories and facts this session added.

export function StudioGateLive(props: StudioGateProps) {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return <StudioGate {...props} />;
}
