"use client";

import {
  PORTAL_LIMITS,
  letterKey,
  type PortalLetter,
  type PortalView,
} from "@admitstory/shared/kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  OWN_CHOICE_NOTE,
  PORTAL_COPY,
  PortalAnswer,
  PortalNotes,
  PortalSubmitted,
  ToastProvider,
  expiryLine,
  useToast,
} from "@admitstory/ui";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PortalRecordHost } from "./portal-record-host";

// The writing half of the recommender's page (Phase 6 plan §8): notes, one answer per question,
// the submitted marks and "Delete everything I wrote".
//
// Everything saves through /api/r/<token>/…, and the token comes from the path this page was
// opened with, so it never has to be rendered into the markup. The dictation client sits behind
// next/dynamic and loads on the first press of the record button.

/** The root layout has no ToastProvider (marketing plan D1), so the portal brings its own. */
export function PortalWork({ view }: { view: PortalView }) {
  return (
    <ToastProvider>
      <PortalWorkBody view={view} />
    </ToastProvider>
  );
}

function PortalWorkBody({ view }: { view: PortalView }) {
  const path = usePathname();
  const { toast } = useToast();
  const [state, setState] = useState(view);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const api = (suffix: string) => `/api/r${path.replace(/^\/r/, "").replace(/\/$/, "")}${suffix}`;

  async function send<T>(
    key: string,
    suffix: string,
    init: { method: string; body?: unknown },
  ): Promise<T | null> {
    setBusy(key);
    try {
      const response = await fetch(api(suffix), {
        method: init.method,
        headers: init.body === undefined ? undefined : { "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!response.ok) {
        setProblem(body?.error ?? PORTAL_COPY.saveFailed);
        return null;
      }
      setProblem(null);
      return body as T;
    } catch {
      setProblem(PORTAL_COPY.saveFailed);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function note(body: Record<string, unknown>, title: string) {
    const result = await send<{ notes: PortalView["notes"] }>("notes", "/notes", {
      method: "POST",
      body,
    });
    if (!result) return;
    setState((current) => ({ ...current, notes: result.notes }));
    toast({ title });
  }

  function putLetter(groupKey: string, questionId: string, letter: PortalLetter) {
    setState((current) => ({
      ...current,
      letters: { ...current.letters, [letterKey(groupKey, questionId)]: letter },
    }));
  }

  async function saveLetter(groupKey: string, questionId: string, text: string) {
    const letter = await send<PortalLetter>(`letter:${questionId}`, "/letter", {
      method: "PUT",
      body: { groupKey, questionId, text },
    });
    if (letter) putLetter(groupKey, questionId, letter);
  }

  async function assist(groupKey: string, questionId: string) {
    const result = await send<{ letter: PortalLetter; assistsLeft: number }>(
      `assist:${questionId}`,
      "/assist",
      { method: "POST", body: { groupKey, questionId } },
    );
    if (!result) return;
    putLetter(groupKey, questionId, result.letter);
    setState((current) => ({ ...current, assistsLeft: result.assistsLeft }));
  }

  async function addNote(text: string, spoken: { seconds: number; language: string } | null) {
    await note({ op: "add", text, spoken }, PORTAL_COPY.savedNote);
    if (!spoken || spoken.seconds <= 0) return;
    const left = await send<{ voiceSecondsLeft: number }>("voice", "/voice", {
      method: "POST",
      body: { seconds: spoken.seconds, language: spoken.language },
    });
    if (left) setState((current) => ({ ...current, voiceSecondsLeft: left.voiceSecondsLeft }));
  }

  async function mark(schoolCycleId: string, submitted: boolean) {
    const result = await send<{ submitted: Record<string, string> }>("submitted", "/submitted", {
      method: "POST",
      body: { schoolCycleId, submitted },
    });
    if (!result) return;
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        schools: group.schools.map((school) => ({
          ...school,
          submittedAt: result.submitted[school.schoolCycleId] ?? null,
        })),
      })),
    }));
  }

  async function wipe() {
    const result = await send<{ wiped: boolean }>("wipe", "", { method: "DELETE" });
    if (!result) return;
    setState((current) => ({
      ...current,
      notes: [],
      letters: {},
      groups: current.groups.map((group) => ({
        ...group,
        schools: group.schools.map((school) => ({ ...school, submittedAt: null })),
      })),
    }));
    toast({ title: "Everything you wrote is deleted" });
  }

  return (
    <div className="flex flex-col gap-12">
      <p aria-live="polite" className="min-h-[1lh] text-sm text-needs">
        {problem}
      </p>

      <PortalNotes
        notes={state.notes}
        maxChars={PORTAL_LIMITS.noteChars}
        canAdd={state.notes.length < PORTAL_LIMITS.notesMax}
        voiceSecondsLeft={state.voiceSecondsLeft}
        busy={busy === "notes" || busy === "voice"}
        onAdd={(text, spoken) => void addNote(text, spoken)}
        onUpdate={(id, text) => void note({ op: "update", id, text }, PORTAL_COPY.savedNote)}
        onDelete={(id) => void note({ op: "delete", id }, PORTAL_COPY.deletedNote)}
        record={(onDictated) => <PortalRecordHost endpoint={api("/stt")} onDictated={onDictated} />}
      />

      <section id="your-letter" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-display-sm text-text">{PORTAL_COPY.letterHeading}</h2>
          <p className="text-base text-text-soft">{PORTAL_COPY.letterLead}</p>
        </div>

        <label className="flex min-h-11 items-start gap-3 text-base text-text">
          <input
            type="checkbox"
            checked={state.preferCoach}
            className="mt-1 size-5"
            onChange={(event) => {
              const preferCoach = event.target.checked;
              setState((current) => ({ ...current, preferCoach }));
              void send("preferences", "/preferences", { method: "POST", body: { preferCoach } });
            }}
          />
          <span className="flex flex-col gap-0.5">
            <span>{PORTAL_COPY.preferCoach}</span>
            <span className="text-sm text-text-soft">{PORTAL_COPY.preferCoachHint}</span>
          </span>
        </label>

        {state.groups.flatMap((group) =>
          group.questions.map((question) => (
            <PortalAnswer
              key={`${group.key}:${question.id}`}
              question={question}
              letter={state.letters[letterKey(group.key, question.id)] ?? null}
              mode={state.preferCoach ? "coach" : group.mode}
              notes={state.notes}
              assistsLeft={state.assistsLeft}
              busy={busy === `assist:${question.id}` || busy === `letter:${question.id}`}
              policyNote={
                group.policyNote ??
                (state.preferCoach && group.mode !== "coach" ? OWN_CHOICE_NOTE : null)
              }
              onAssist={() => void assist(group.key, question.id)}
              onChange={(text) => void saveLetter(group.key, question.id, text)}
              onCopy={() => toast({ title: PORTAL_COPY.copiedAnswer })}
              maxChars={PORTAL_LIMITS.letterChars}
            />
          )),
        )}
      </section>

      <PortalSubmitted
        schools={state.groups.flatMap((group) => group.schools)}
        busy={busy === "submitted"}
        onChange={(schoolCycleId, submitted) => void mark(schoolCycleId, submitted)}
      />

      <footer className="flex flex-col gap-3 border-t border-edge pt-6">
        <p className="text-sm text-text-soft">{expiryLine(state.expiresAt)}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="quiet" size="sm">
              {PORTAL_COPY.deleteEverything}
            </Button>
          </DialogTrigger>
          <DialogContent title={PORTAL_COPY.deleteTitle} description={PORTAL_COPY.deleteBody}>
            <Button variant="danger" loading={busy === "wipe"} onClick={() => void wipe()}>
              {PORTAL_COPY.deleteConfirm}
            </Button>
          </DialogContent>
        </Dialog>
      </footer>
    </div>
  );
}
