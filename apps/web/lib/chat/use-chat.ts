"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatThreadView, ChatTurn } from "./types";

// The chat panel's client side: loads the thread, sends a message (shown at once, before the
// change lands), undoes a change, and tells the screen to reload its document after either.

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  if (!response) return fallback;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function useChat(
  thread: string,
  options: { initial?: ChatTurn[]; onChanged?: () => void | Promise<void> } = {},
) {
  const { initial, onChanged } = options;
  const [turns, setTurns] = useState<ChatTurn[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) return;
    let live = true;
    void fetch(`/api/chat?thread=${encodeURIComponent(thread)}`)
      .then((r) => (r.ok ? (r.json() as Promise<ChatThreadView>) : null))
      .then((view) => {
        if (live && view) setTurns(view.turns);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
    // One load per thread; `initial` is only the server's first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  const send = useCallback(
    async (message: string) => {
      setError("");
      setBusy(true);
      const pending: ChatTurn = {
        id: `pending-${Date.now()}`,
        role: "you",
        text: message,
        at: new Date().toISOString(),
        canUndo: false,
      };
      setTurns((t) => [...t, pending]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, message }),
      }).catch(() => null);
      setBusy(false);
      if (!response?.ok) {
        setTurns((t) => t.filter((x) => x.id !== pending.id));
        setError(await errorOf(response, "Nothing changed. Check your connection and try again."));
        return;
      }
      setTurns(((await response.json()) as ChatThreadView).turns);
      await onChanged?.();
    },
    [thread, onChanged],
  );

  const undo = useCallback(
    async (messageId: string) => {
      setError("");
      setBusy(true);
      const response = await fetch("/api/chat/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, messageId }),
      }).catch(() => null);
      setBusy(false);
      if (!response?.ok) {
        setError(await errorOf(response, "That didn't undo. Try again."));
        return;
      }
      setTurns(((await response.json()) as ChatThreadView).turns);
      await onChanged?.();
    },
    [thread, onChanged],
  );

  return { turns, busy, error, send, undo, setTurns };
}
