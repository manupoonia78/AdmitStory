"use client";

// A one-line module so the constellation can be code-split on its own. Importing
// `@admitstory/ui` inside next/dynamic would pull the whole barrel into the first load; a local
// file that re-exports it gives Turbopack a single, small entry point to split on.
export { Constellation } from "@admitstory/ui";
