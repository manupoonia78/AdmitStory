"use client";

import { buttonStyles, cx } from "@admitstory/ui";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AlertMessage } from "@/components/live-message";
import {
  personLine,
  type ConnectMessageDto,
  type ConnectPersonDto,
  type ConnectRelationDto,
  type ConnectThreadDto,
} from "@/lib/connect/types";

// Connect (Manu, 2026-11-04): a messaging window, LinkedIn- and WhatsApp-style. On the left, two
// tabs: your conversations, and a directory search over alumni, current students and admissions
// readers. On the right, the open conversation, or the profile of someone you found with a box to
// write to them. Below 1024px it is one column that switches between the two.
//
// No sockets: the open conversation polls every 5 s while the tab is visible, and the inbox every
// 20 s. No Radix and no Motion, so the chunk stays small (spec §6.11).

const MESSAGE_POLL_MS = 5_000;
const INBOX_POLL_MS = 20_000;
const SEARCH_DEBOUNCE_MS = 250;

export interface ConnectScreenProps {
  /** Holds a school pack; a guide without one only answers. */
  canSearch: boolean;
  initialThreads: ConnectThreadDto[];
  initialPeople: ConnectPersonDto[];
  schools: { id: string; name: string; people: number; yours: boolean }[];
}

type Selection =
  { kind: "thread"; id: string } | { kind: "person"; person: ConnectPersonDto } | null;

const RELATIONS: { id: ConnectRelationDto | ""; label: string }[] = [
  { id: "", label: "Everyone" },
  { id: "alum", label: "Alumni" },
  { id: "student", label: "Students" },
  { id: "adcom", label: "Admissions" },
];

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "That didn't work. Try again.");
  return body;
}

const postJson = <T,>(url: string, payload: unknown) =>
  getJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

export function ConnectScreen({
  canSearch,
  initialThreads,
  initialPeople,
  schools,
}: ConnectScreenProps) {
  const [tab, setTab] = useState<"messages" | "find">(
    initialThreads.length > 0 || !canSearch ? "messages" : "find",
  );
  const [threads, setThreads] = useState(initialThreads);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState("");

  const refreshThreads = useCallback(async () => {
    try {
      const { threads: next } = await getJson<{ threads: ConnectThreadDto[] }>(
        "/api/connect/threads",
      );
      setThreads(next);
    } catch {
      // The inbox keeps what it has; the next poll tries again.
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshThreads();
    }, INBOX_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshThreads]);

  const openPerson = (person: ConnectPersonDto) => {
    const existing = threads.find((t) => t.side === "applicant" && t.person.id === person.id);
    setSelection(existing ? { kind: "thread", id: existing.id } : { kind: "person", person });
  };

  const unread = threads.filter((thread) => thread.unread).length;
  const openThread =
    selection?.kind === "thread" ? threads.find((t) => t.id === selection.id) : null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] min-h-[34rem] w-full max-w-[90rem] flex-col gap-4 px-4 py-4 sm:px-8 lg:h-[calc(100dvh-1rem)] lg:py-8">
      <header
        className={cx("flex items-baseline justify-between gap-4", selection && "max-lg:hidden")}
      >
        <h1 className="font-display text-[2rem] leading-none text-text">Connect</h1>
        <p className="meta hidden sm:block">Alumni · students · admissions readers</p>
      </header>

      <div className="plane grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[23rem_minmax(0,1fr)]">
        {/* Left: the inbox and the directory. */}
        <aside
          className={cx(
            "flex min-h-0 min-w-0 flex-col border-edge lg:border-e",
            selection && "max-lg:hidden",
          )}
        >
          <div role="tablist" aria-label="Connect" className="flex border-b border-edge">
            <TabButton active={tab === "messages"} onClick={() => setTab("messages")}>
              Messages
              {unread > 0 ? (
                <span className="ms-2 rounded-full bg-accent px-1.5 text-xs text-space tabular-nums">
                  {unread}
                </span>
              ) : null}
            </TabButton>
            {canSearch ? (
              <TabButton active={tab === "find"} onClick={() => setTab("find")}>
                Find people
              </TabButton>
            ) : null}
          </div>
          {tab === "messages" ? (
            <ThreadList
              threads={threads}
              selectedId={openThread?.id ?? null}
              onOpen={(id) => setSelection({ kind: "thread", id })}
              onFind={canSearch ? () => setTab("find") : null}
            />
          ) : (
            <Directory
              initialPeople={initialPeople}
              schools={schools}
              selectedId={selection?.kind === "person" ? selection.person.id : null}
              onOpen={openPerson}
            />
          )}
        </aside>

        {/* Right: the conversation or a profile. */}
        <section
          aria-label="Conversation"
          className={cx("flex min-h-0 min-w-0 flex-col", !selection && "max-lg:hidden")}
        >
          {openThread ? (
            <Conversation
              key={openThread.id}
              thread={openThread}
              onBack={() => setSelection(null)}
              onSent={refreshThreads}
            />
          ) : selection?.kind === "person" ? (
            <Profile
              key={selection.person.id}
              person={selection.person}
              onBack={() => setSelection(null)}
              onStarted={async (threadId) => {
                await refreshThreads();
                setTab("messages");
                setSelection({ kind: "thread", id: threadId });
              }}
              onError={setError}
            />
          ) : (
            <EmptyPane canSearch={canSearch} />
          )}
          <AlertMessage message={error} />
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "flex flex-1 items-center justify-center border-b-2 px-4 py-3.5 text-sm transition-colors",
        active ? "border-text text-text" : "border-transparent text-text-soft hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/* Avatars ----------------------------------------------------------------------------------- */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

function Avatar({
  name,
  photoUrl,
  size = 44,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (photoUrl)
    return (
      // A directory photo from wherever it is hosted (the CSP allows LinkedIn's CDN): small,
      // lazy and fixed-size, so next/image's optimizer would only add a hop.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-full bg-depth object-cover"
        style={style}
      />
    );
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-text font-display text-space"
      style={{ ...style, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

function GuideBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 px-2 py-0.5 text-[0.6875rem] text-accent">
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      Works with us
    </span>
  );
}

/* The inbox --------------------------------------------------------------------------------- */

/** Who the viewer is talking to: the person, or for a guide, the applicant who wrote in. */
function counterpart(thread: ConnectThreadDto) {
  return thread.side === "person"
    ? {
        name: thread.applicantName ?? "An applicant",
        photoUrl: null,
        line: `Writing to you as ${thread.person.fullName}`,
      }
    : {
        name: thread.person.fullName,
        photoUrl: thread.person.photoUrl,
        line: personLine(thread.person),
      };
}

const noSubscription = () => () => {};

/**
 * True once hydrated. Times are formatted in the viewer's locale and time zone, which the server
 * can't know, so the inbox shows them only on the client (no hydration mismatch).
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

function when(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ThreadList({
  threads,
  selectedId,
  onOpen,
  onFind,
}: {
  threads: ConnectThreadDto[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onFind: (() => void) | null;
}) {
  const hydrated = useHydrated();
  if (threads.length === 0)
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4 p-6">
        <p className="font-display text-[1.375rem] leading-tight text-text">
          No conversations yet.
        </p>
        <p className="text-text-soft">
          Find someone from a school you’re applying to and say hello. A short, specific question
          gets the best answer.
        </p>
        {onFind ? (
          <button type="button" onClick={onFind} className={buttonStyles({ variant: "primary" })}>
            Find people
          </button>
        ) : null}
      </div>
    );
  return (
    <ul role="list" className="min-h-0 flex-1 divide-y divide-edge overflow-y-auto">
      {threads.map((thread) => {
        const who = counterpart(thread);
        const selected = thread.id === selectedId;
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onOpen(thread.id)}
              aria-current={selected || undefined}
              className={cx(
                "flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors",
                selected ? "bg-depth" : "hover:bg-depth/60",
              )}
            >
              <Avatar name={who.name} photoUrl={who.photoUrl} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cx("truncate text-text", thread.unread && "font-semibold")}>
                    {who.name}
                  </span>
                  <span className="meta shrink-0">
                    {hydrated ? when(thread.lastMessageAt) : ""}
                  </span>
                </span>
                <span className="truncate text-xs text-text-soft">{who.line}</span>
                <span
                  className={cx("truncate text-sm", thread.unread ? "text-text" : "text-text-soft")}
                >
                  {thread.status === "requested" && thread.side === "applicant"
                    ? "Intro requested"
                    : thread.lastMessage
                      ? `${thread.lastMessage.mine ? "You: " : ""}${thread.lastMessage.body}`
                      : ""}
                </span>
              </span>
              {thread.unread ? (
                <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* The directory ----------------------------------------------------------------------------- */

function Directory({
  initialPeople,
  schools,
  selectedId,
  onOpen,
}: {
  initialPeople: ConnectPersonDto[];
  schools: ConnectScreenProps["schools"];
  selectedId: string | null;
  onOpen: (person: ConnectPersonDto) => void;
}) {
  const searchId = useId();
  const schoolId = useId();
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [relation, setRelation] = useState<ConnectRelationDto | "">("");
  const [people, setPeople] = useState(initialPeople);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState("");
  /** The server already ran the empty search, so nothing runs until a filter changes. */
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query, school, relation });
        const { people: found } = await getJson<{ people: ConnectPersonDto[] }>(
          `/api/connect/people?${params}`,
          { signal: controller.signal },
        );
        setPeople(found);
        setProblem("");
      } catch (caught) {
        if (!controller.signal.aborted)
          setProblem(caught instanceof Error ? caught.message : "The search didn't run.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [touched, query, school, relation]);

  const yours = useMemo(() => schools.filter((s) => s.yours), [schools]);
  const others = useMemo(() => schools.filter((s) => !s.yours), [schools]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-edge p-4">
        <label htmlFor={searchId} className="sr-only">
          Search people
        </label>
        <div className="relative">
          <SearchGlyph />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setTouched(true);
              setQuery(event.target.value);
            }}
            placeholder="Name, company, role or topic"
            autoComplete="off"
            className="w-full rounded-control border border-control-edge bg-space py-2.5 ps-10 pe-3 text-sm text-text placeholder:text-text-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={schoolId} className="sr-only">
            School
          </label>
          <select
            id={schoolId}
            value={school}
            onChange={(event) => {
              setTouched(true);
              setSchool(event.target.value);
            }}
            className="min-w-0 flex-1 rounded-control border border-control-edge bg-space px-3 py-2 text-sm text-text"
          >
            <option value="">All schools</option>
            {yours.length > 0 ? (
              <optgroup label="Your schools">
                {yours.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.people}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {others.length > 0 ? (
              <optgroup label="Other schools">
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.people}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div role="group" aria-label="Who" className="flex flex-wrap gap-1.5">
          {RELATIONS.map((option) => (
            <button
              key={option.id || "all"}
              type="button"
              aria-pressed={relation === option.id}
              onClick={() => {
                setTouched(true);
                setRelation(option.id);
              }}
              className={cx(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                relation === option.id
                  ? "border-text bg-text text-space"
                  : "border-control-edge text-text-soft hover:text-text",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="meta px-4 pt-3">
        {searching
          ? "Searching…"
          : problem || `${people.length} ${people.length === 1 ? "person" : "people"}`}
      </p>
      {people.length === 0 && !searching ? (
        <div className="flex flex-col gap-2 p-4">
          <p className="text-text">Nobody matches yet.</p>
          <p className="text-sm text-text-soft">
            We add people every week. Try fewer words, or another school.
          </p>
        </div>
      ) : (
        <ul role="list" className="min-h-0 flex-1 overflow-y-auto py-1">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onOpen(person)}
                aria-current={person.id === selectedId || undefined}
                className={cx(
                  "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors",
                  person.id === selectedId ? "bg-depth" : "hover:bg-depth/60",
                )}
              >
                <Avatar name={person.fullName} photoUrl={person.photoUrl} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-text">{person.fullName}</span>
                    {person.guide ? <GuideBadge /> : null}
                  </span>
                  <span className="truncate text-sm text-text-soft">{person.headline}</span>
                  <span className="meta truncate">{personLine(person)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-soft"
    >
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* The right pane ---------------------------------------------------------------------------- */

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ms-2 rounded-control px-2 py-1 text-sm text-text-soft hover:text-text lg:hidden"
    >
      ← Back
    </button>
  );
}

function EmptyPane({ canSearch }: { canSearch: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="font-display text-[1.75rem] leading-tight text-text">
        {canSearch ? "Pick a conversation, or find someone." : "Pick a conversation."}
      </p>
      <p className="max-w-md text-text-soft">
        People who work with us answer here, usually within a couple of days. For anyone else, we
        pass your first message on and introduce you.
      </p>
    </div>
  );
}

function Profile({
  person,
  onBack,
  onStarted,
  onError,
}: {
  person: ConnectPersonDto;
  onBack: () => void;
  onStarted: (threadId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const firstName = person.fullName.split(/\s+/)[0] ?? person.fullName;
  const [sending, setSending] = useState(false);

  const send = async (body: string) => {
    setSending(true);
    onError("");
    try {
      const { threadId } = await postJson<{ threadId: string }>("/api/connect/threads", {
        personId: person.id,
        body,
      });
      await onStarted(threadId);
      return true;
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "That message didn't send.");
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-10">
        <BackButton onBack={onBack} />
        <div className="mt-2 flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar name={person.fullName} photoUrl={person.photoUrl} size={96} />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[2rem] leading-tight text-text">
                {person.fullName}
              </h2>
              {person.guide ? <GuideBadge /> : null}
            </div>
            <p className="text-lg text-text">{person.headline}</p>
            <p className="meta">
              {personLine(person)}
              {person.location ? ` · ${person.location}` : ""}
            </p>
            {person.linkedinUrl ? (
              <a
                href={person.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start text-sm text-signal underline-offset-4 hover:underline"
              >
                LinkedIn profile ↗
              </a>
            ) : null}
          </div>
        </div>
        {person.bio ? (
          <p className="mt-8 max-w-2xl font-reading text-reading text-text">{person.bio}</p>
        ) : null}
        {person.topics.length > 0 ? (
          <div className="mt-6 flex flex-col gap-2">
            <p className="eyebrow">Happy to talk about</p>
            <ul role="list" className="flex flex-wrap gap-2">
              {person.topics.map((topic) => (
                <li
                  key={topic}
                  className="rounded-full border border-edge px-3 py-1 text-sm text-text"
                >
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-8 max-w-2xl text-sm text-text-soft">
          {person.guide
            ? `${firstName} works with us and answers here, usually within a couple of days.`
            : `${firstName} doesn’t work with us yet. We’ll pass your message on and introduce you; their reply appears here.`}{" "}
          {person.relation === "adcom"
            ? "Ask how applications are read, not for a decision: nobody here can promise one."
            : "A short, specific question gets the best answer."}
        </p>
      </div>
      <Composer
        placeholder={`Write to ${firstName}…`}
        action={person.guide ? "Send" : "Ask for an intro"}
        busy={sending}
        onSend={send}
      />
    </div>
  );
}

function Conversation({
  thread,
  onBack,
  onSent,
}: {
  thread: ConnectThreadDto;
  onBack: () => void;
  onSent: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<ConnectMessageDto[] | null>(null);
  const [status, setStatus] = useState(thread.status);
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef<string | null>(null);
  const who = counterpart(thread);

  const load = useCallback(async () => {
    const after = latest.current;
    const url = `/api/connect/threads/${thread.id}${after ? `?after=${encodeURIComponent(after)}` : ""}`;
    try {
      const result = await getJson<{
        status: ConnectThreadDto["status"];
        messages: ConnectMessageDto[];
      }>(url);
      setStatus(result.status);
      if (result.messages.length === 0 && after) return;
      setMessages((current) => {
        // A poll (`after`) appends what's new; the first load replaces.
        const base = after ? (current ?? []) : [];
        const known = new Set(base.map((m) => m.id));
        const merged = [...base, ...result.messages.filter((m) => !known.has(m.id))];
        latest.current = merged.at(-1)?.at ?? null;
        return merged;
      });
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "This conversation didn't load.");
    }
  }, [thread.id]);

  useEffect(() => {
    // The first load and the poll both happen off the effect's own tick, so it sets no state
    // synchronously.
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, MESSAGE_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = async (body: string) => {
    setSending(true);
    setProblem("");
    try {
      const { message } = await postJson<{ message: ConnectMessageDto }>(
        `/api/connect/threads/${thread.id}`,
        { body },
      );
      setMessages((current) => {
        if (current?.some((m) => m.id === message.id)) return current;
        latest.current = message.at;
        return [...(current ?? []), message];
      });
      if (thread.side === "person") setStatus("open");
      void onSent();
      return true;
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "That message didn't send.");
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3 sm:px-6">
        <BackButton onBack={onBack} />
        <Avatar name={who.name} photoUrl={who.photoUrl} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate text-text">{who.name}</span>
            {thread.side === "applicant" && thread.person.guide ? <GuideBadge /> : null}
          </span>
          <span className="truncate text-xs text-text-soft">{who.line}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {status === "requested" ? (
          <p className="mx-auto mb-6 max-w-md rounded-plane border border-dashed border-control-edge px-4 py-3 text-center text-sm text-text-soft">
            {thread.side === "applicant"
              ? `Intro requested. We’ve passed your message to ${thread.person.fullName.split(/\s+/)[0]}; their reply will appear here.`
              : "They’re waiting for your first reply."}
          </p>
        ) : null}
        {messages === null ? (
          <p className="meta text-center">Loading…</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay =
                !previous ||
                new Date(previous.at).toDateString() !== new Date(message.at).toDateString();
              return (
                <li key={message.id} className="flex flex-col">
                  {newDay ? (
                    <span className="meta my-3 self-center">
                      {new Date(message.at).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  ) : null}
                  {message.author === "team" ? (
                    <p className="my-1 self-center text-center text-xs text-text-soft">
                      AdmitStories team: {message.body}
                    </p>
                  ) : (
                    <div
                      className={cx(
                        "max-w-[min(34rem,85%)] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-relaxed",
                        message.mine
                          ? "self-end rounded-br-md bg-text text-space"
                          : "self-start rounded-bl-md border border-edge bg-depth text-text",
                      )}
                    >
                      {message.body}
                      <span
                        className={cx(
                          "mt-1 block text-end text-[0.6875rem]",
                          message.mine ? "text-space/70" : "text-text-soft",
                        )}
                      >
                        {new Date(message.at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottom} />
      </div>
      <AlertMessage message={problem} />
      <Composer placeholder="Write a message…" action="Send" busy={sending} onSend={send} />
    </div>
  );
}

function Composer({
  placeholder,
  action,
  busy,
  onSend,
}: {
  placeholder: string;
  action: string;
  busy: boolean;
  /** Resolves true when sent, so the draft clears only then. */
  onSend: (body: string) => Promise<boolean>;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    if (await onSend(body)) setDraft("");
  };
  return (
    <form
      className="flex items-end gap-3 border-t border-edge p-3 sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter makes a new line, as in every messenger.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        rows={1}
        maxLength={4000}
        placeholder={placeholder}
        className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-control border border-control-edge bg-space px-3.5 py-2.5 text-[0.9375rem] text-text placeholder:text-text-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      />
      <button
        type="submit"
        disabled={busy || draft.trim() === ""}
        className={cx(buttonStyles({ variant: "primary" }), "min-h-11 shrink-0")}
      >
        {busy ? "Sending…" : action}
      </button>
    </form>
  );
}
