import type { PlaceholderPageProps } from "./placeholder-page";

// Copy for areas that aren't open yet (spec §6.7: plain, warm, direct; honest about what exists).
// An empty state is a headline and one short line (spec §6.5); placeholder-copy.test.ts keeps each
// description to one line of at most 64 characters. It still wraps on a phone, so PlaceholderPage
// keeps EmptyState's default left alignment rather than centring it.
export const PLACEHOLDERS = {
  home: {
    title: "Home",
    emptyTitle: "Your story starts here",
    emptyDescription: "Story Studio opens soon, and your stories will collect here.",
  },
  studio: {
    title: "Story Studio",
    emptyTitle: "No stories yet",
    emptyDescription: "Story Studio isn't open yet. Your stories will appear here.",
  },
  schools: {
    title: "Schools",
    emptyTitle: "No schools yet",
    emptyDescription: "School Strategy isn't open yet. Your schools will appear here.",
  },
  interview: {
    title: "Interview",
    emptyTitle: "No practice yet",
    emptyDescription: "Interview Studio isn't open yet. Practice will appear here.",
  },
  connect: {
    title: "Connect",
    emptyTitle: "No contacts yet",
    emptyDescription: "Connect isn't open yet. Your contacts will appear here.",
  },
  tracker: {
    title: "Tracker",
    emptyTitle: "Nothing to track yet",
    emptyDescription: "The tracker isn't open yet. Your deadlines will appear here.",
  },
} satisfies Record<string, PlaceholderPageProps>;
