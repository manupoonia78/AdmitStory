"use client";

// "Send me a fresh link" behind a next/dynamic boundary, so a closed link's page ships only its
// words on first load (spec §6.11).

import dynamic from "next/dynamic";

export const ResendFormHost = dynamic(() => import("./resend-form").then((m) => m.ResendForm));
