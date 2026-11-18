"use client";

import { ArrowCounterClockwiseIcon, ArrowUpIcon } from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx";

export interface ChatPanelTurn {
  id: string;
  role: "you" | "coach";
  text: string;
  /** A coach turn whose change can still be put back. */
  canUndo?: boolean;
}

export interface ChatPanelProps {
  turns: readonly ChatPanelTurn[];
  /** Sends one message; resolves once the change is made (or failed). */
  onSend: (text: string) => void | Promise<void>;
  onUndo?: (turnId: string) => void;
  /** True while a message is being worked on. */
  busy?: boolean;
  /** What the chat changes, for the empty state: "this essay", "your résumé". */
  subject: string;
  /** One-tap requests for the empty state and under the composer. */
  suggestions?: readonly string[];
  /** Shown above the composer: an error or a note ("12 refinements left"). */
  notice?: ReactNode;
  placeholder?: string;
  className?: string;
}

/**
 * The chat beside every school document (school workspace redesign): say what you want changed
 * in plain words and the document beside it changes. Each change comes with Undo. Enter sends,
 * Shift+Enter starts a new line. The thread is a live log, so screen readers hear each reply.
 */
export function ChatPanel({
  turns,
  onSend,
  onUndo,
  busy = false,
  subject,
  suggestions = [],
  notice,
  placeholder,
  className,
}: ChatPanelProps) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns.length, busy]);

  // Grow with the text, up to about eight lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setValue("");
    void onSend(message);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(value);
    }
  };

  const lastUndo = [...turns].reverse().find((t) => t.role === "coach" && t.canUndo)?.id;

  return (
    <div className={cx("flex h-full min-h-0 flex-col", className)}>
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4 pt-5"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-title text-text">Tell me what to change in {subject}.</p>
            <p className="text-sm text-text-soft">
              Plain words work best: &ldquo;make the opening about the night shift&rdquo;,
              &ldquo;shorter&rdquo;, &ldquo;I don&rsquo;t like this line&rdquo;. Every change comes
              with Undo.
            </p>
            {suggestions.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Try one">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => send(s)}
                      className="chip h-9 text-text transition-colors duration-(--dur-hover) hover:bg-frost-hover disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          turns.map((turn) =>
            turn.role === "you" ? (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-[1.125rem] rounded-br-md bg-veil px-4 py-2.5 text-ui font-normal text-text">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={turn.id} className="flex flex-col items-start gap-2">
                <p className="label">Coach</p>
                <p className="whitespace-pre-wrap font-reading text-base leading-[1.6] text-text">
                  {turn.text}
                </p>
                {/* Only the latest change: undoing an older one would also drop the ones after. */}
                {turn.canUndo && onUndo && turn.id === lastUndo ? (
                  <button
                    type="button"
                    onClick={() => onUndo(turn.id)}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-control text-sm text-text-soft underline-offset-4 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:opacity-50"
                  >
                    <ArrowCounterClockwiseIcon aria-hidden size={14} />
                    Undo this change
                  </button>
                ) : null}
              </div>
            ),
          )
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-text-soft" aria-label="Working on it">
            <span className="label">Coach</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-text-soft motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </span>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <div className="flex flex-col gap-2 border-t border-edge px-4 pb-4 pt-3">
        {notice ? <div className="text-sm text-text-soft">{notice}</div> : null}
        {turns.length > 0 && suggestions.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Quick changes" data-no-swipe>
            {suggestions.slice(0, 4).map((s) => (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(s)}
                  className="chip h-8 font-normal text-text-soft transition-colors duration-(--dur-hover) hover:bg-frost-hover hover:text-text disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          onSubmit={submit}
          className="flex items-end gap-2 rounded-control border border-control bg-field py-1.5 pl-4 pr-1.5 transition-colors duration-(--dur-hover) focus-within:border-text"
        >
          <label htmlFor={inputId} className="sr-only">
            What to change
          </label>
          <textarea
            id={inputId}
            ref={input}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={2_000}
            placeholder={placeholder ?? "Say what to change…"}
            className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base text-text caret-accent outline-none placeholder:text-text-soft"
          />
          <button
            type="submit"
            disabled={busy || value.trim() === ""}
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-signal text-on-signal transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:opacity-30"
          >
            <ArrowUpIcon aria-hidden size={16} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}
