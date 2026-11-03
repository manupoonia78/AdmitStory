import { RESEND_COPY } from "@admitstory/ui";
import type { Metadata } from "next";
import { PortalFrame } from "./portal-frame";
import { ResendFormHost } from "./resend-form-host";

export const metadata: Metadata = {
  title: "Send me a fresh link",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// /r: where a recommender lands when their link no longer opens (spec §5.11, decision 9).

export default function Page() {
  return (
    <PortalFrame>
      <div className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">{RESEND_COPY.heading}</h1>
        <ResendFormHost />
      </div>
    </PortalFrame>
  );
}
