// What the chat panel shows (school workspace redesign). Plain types only, so client components
// can import them.

export interface ChatTurn {
  id: string;
  role: "you" | "coach";
  text: string;
  /** ISO time. */
  at: string;
  /** A coach turn whose change can still be put back. */
  canUndo: boolean;
}

export interface ChatThreadView {
  thread: string;
  turns: ChatTurn[];
}
