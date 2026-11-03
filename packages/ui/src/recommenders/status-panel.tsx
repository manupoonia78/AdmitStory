"use client";

// Screen H, the Status and reminders tab. The applicant sees state and dates, and nothing else
// (§14.3, plan decision 7): never the notes, never the letter, never the private link. The
// invitation and every reminder is shown as the email it will be, with the link written as
// "[your private link]", because the link belongs to the recommender's inbox alone.

import type { EmailPreview, ReminderView, StatusView } from "@admitstory/shared/kit";
import { RECOMMENDER_STATUSES } from "@admitstory/shared/kit";
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../components/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../components/dialog";
import { StatusLabel } from "../components/status-label";
import { cx } from "../lib/cx";
import {
  onDate,
  recommenderPrivacyLine,
  reminderBlockedReason,
  reminderLabel,
  REMINDER_STATE_WORDS,
  statusWord,
} from "./recommender-text";

export const NOTE_MAX = 300;

function EmailPaper({ preview }: { preview: EmailPreview }) {
  return (
    <div className="plane flex max-w-essay flex-col gap-3 p-4">
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-text-soft">To</dt>
          <dd className="text-text">{preview.to}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-text-soft">Reply to</dt>
          <dd className="text-text">{preview.replyTo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-text-soft">Subject</dt>
          <dd className="text-text">{preview.subject}</dd>
        </div>
      </dl>
      <p className="whitespace-pre-line font-reading text-read text-text">{preview.text}</p>
    </div>
  );
}

export interface StatusPanelProps {
  firstName: string;
  status: StatusView;
  timeZone: string;
  onSend: (previewHash: string) => void;
  onSchedule: (previewHash: string) => void;
  onReissue: () => void;
  onRevoke: () => void;
  /** Records that a reminder's words have been read. */
  onRead: (reminder: ReminderView) => void;
  onToggle: (reminder: ReminderView, on: boolean) => void;
  onNote: (reminder: ReminderView, note: string) => void;
  /** Which control is mid-flight, so it can say so. */
  working?: string | null;
  className?: string;
}

export function StatusPanel({
  firstName,
  status,
  timeZone,
  onSend,
  onSchedule,
  onReissue,
  onRevoke,
  onRead,
  onToggle,
  onNote,
  working = null,
  className,
}: StatusPanelProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const invite = status.invite;
  const at = (step: string) => status.timeline.find((entry) => entry.step === step)?.at ?? null;

  return (
    <div className={cx("flex flex-col gap-10", className)}>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-text">Where things stand</h3>
        <ol className="flex flex-col border-t border-edge">
          {RECOMMENDER_STATUSES.map((step) => {
            const when = at(step);
            const reached = when !== null || step === status.status;
            return (
              <li
                key={step}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-edge py-3"
              >
                <span className="flex items-center gap-2">
                  {reached ? (
                    <CheckCircleIcon size={16} aria-hidden className="shrink-0 text-verified" />
                  ) : (
                    <CircleIcon size={16} aria-hidden className="shrink-0 text-text-soft" />
                  )}
                  <span className={reached ? "text-text" : "text-text-soft"}>
                    {statusWord(step)}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-text-soft">
                  {when ? onDate(when, timeZone) : "—"}
                </span>
              </li>
            );
          })}
        </ol>
        {status.submitted.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {status.submitted.map((school) => (
              <li key={school.schoolCycleId} className="text-sm tabular-nums text-text-soft">
                {school.school}:{" "}
                {school.at ? `marked submitted ${onDate(school.at, timeZone)}` : "not marked yet"}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="max-w-essay text-text-soft">{recommenderPrivacyLine(firstName)}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-text">The invitation</h3>
        {invite.status === "none" ? null : (
          <p className="text-sm tabular-nums text-text-soft">
            {invite.status === "active"
              ? "Sent"
              : invite.status === "expired"
                ? "Expired"
                : "Turned off"}
            {invite.sentAt ? ` ${onDate(invite.sentAt, timeZone)}` : ""}
            {invite.expiresAt
              ? ` · the link works until ${onDate(invite.expiresAt, timeZone)}`
              : ""}
            {invite.lastOpenedAt ? ` · last opened ${onDate(invite.lastOpenedAt, timeZone)}` : ""}
          </p>
        )}
        {invite.preview ? <EmailPaper preview={invite.preview} /> : null}
        {invite.blockedReason ? <p className="text-text-soft">{invite.blockedReason}</p> : null}
        <div className="flex flex-wrap gap-2">
          {invite.preview && invite.canSend ? (
            <Button
              onClick={() => onSend(invite.preview?.previewHash ?? "")}
              disabled={working === "invite"}
            >
              {working === "invite" ? "Sending" : `Send to ${invite.preview.to}`}
            </Button>
          ) : null}
          {invite.preview && invite.canSend && invite.scheduled ? (
            <Button
              variant="secondary"
              onClick={() => onSchedule(invite.preview?.previewHash ?? "")}
              disabled={working === "invite"}
            >
              Send on {onDate(invite.scheduled.sendOn, timeZone)}
            </Button>
          ) : null}
          {invite.status === "active" ? (
            <>
              <Button variant="secondary" onClick={onReissue} disabled={working === "invite"}>
                Send a fresh link
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="quiet">Turn off the link</Button>
                </DialogTrigger>
                <DialogContent
                  title="Turn off the link"
                  description={`${firstName}'s page stops working at once. Anything they wrote stays with them, and you can send a fresh link later.`}
                >
                  <div className="flex flex-wrap gap-2">
                    <DialogClose asChild>
                      <Button variant="danger" onClick={onRevoke}>
                        Turn off the link
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="quiet">Keep it on</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
          {invite.status === "revoked" || invite.status === "expired" ? (
            <Button onClick={onReissue} disabled={working === "invite"}>
              Send a fresh link
            </Button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-text">Reminders</h3>
        <p className="max-w-essay text-text-soft">
          Nothing goes out until you have read it and turned it on. Each one is sent from your name
          and replies come to you.
        </p>
        {status.reminders.length === 0 ? (
          <p className="text-text-soft">
            No reminders yet. They appear once a school with a deadline is on your list.
          </p>
        ) : (
          <ul className="flex flex-col border-t border-edge">
            {status.reminders.map((reminder) => {
              const state = REMINDER_STATE_WORDS[reminder.state];
              const blocked = reminderBlockedReason(reminder);
              const note = notes[reminder.id] ?? reminder.note ?? "";
              const expanded = open === reminder.id;
              return (
                <li key={reminder.id} className="flex flex-col gap-2 border-b border-edge py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="w-24 shrink-0 text-sm tabular-nums text-text-soft">
                        {onDate(reminder.sendOn, timeZone)}
                      </span>
                      <span className="text-text">{reminderLabel(reminder.kind)}</span>
                      {reminder.schools.length > 0 ? (
                        <span className="text-sm text-text-soft">
                          {reminder.schools.join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <StatusLabel tone={state.tone}>{state.word}</StatusLabel>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-expanded={expanded}
                      onClick={() => {
                        setOpen(expanded ? null : reminder.id);
                        if (!expanded) onRead(reminder);
                      }}
                    >
                      {expanded ? "Hide it" : "Read it"}
                    </Button>
                    {reminder.state === "on" ? (
                      <Button variant="quiet" size="sm" onClick={() => onToggle(reminder, false)}>
                        Turn off
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onToggle(reminder, true)}
                        disabled={blocked !== null}
                      >
                        Turn on
                      </Button>
                    )}
                  </div>
                  {blocked ? <p className="text-sm text-text-soft">{blocked}</p> : null}
                  {reminder.skippedReason ? (
                    <p className="text-sm text-text-soft">{reminder.skippedReason}</p>
                  ) : null}

                  {expanded ? (
                    <div className="flex flex-col gap-3 pt-1">
                      <EmailPaper preview={reminder.preview} />
                      <label className="flex max-w-essay flex-col gap-1">
                        <span className="text-sm font-medium text-text">
                          A line of your own (optional)
                        </span>
                        <textarea
                          rows={2}
                          maxLength={NOTE_MAX}
                          value={note}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [reminder.id]: event.target.value.slice(0, NOTE_MAX),
                            }))
                          }
                          onBlur={() => {
                            if ((reminder.note ?? "") !== note) onNote(reminder, note);
                          }}
                          className="min-h-11 w-full resize-y rounded-control border border-control bg-depth px-3 py-2 text-lg text-text sm:text-base"
                        />
                        <span className="text-sm tabular-nums text-text-soft">
                          {note.length} / {NOTE_MAX}. Change it and you&apos;ll be asked to read the
                          reminder again before it can go.
                        </span>
                      </label>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
