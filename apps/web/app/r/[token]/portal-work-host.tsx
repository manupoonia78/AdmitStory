"use client";

// The writing half of the portal behind a next/dynamic boundary (spec §6.11): the page's reading
// half is server rendered and arrives first, and the notes, answers and dialogs load after it, so
// the route's first load stays inside the budget.

import dynamic from "next/dynamic";

export const PortalWorkHost = dynamic(() => import("./portal-work").then((m) => m.PortalWork));
