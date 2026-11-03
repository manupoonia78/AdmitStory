"use client";

// "Tell Ravi's stories" (Appendix F, plan decision 11): the seven intake questions, one at a
// time, each answered by speaking or by typing. Nothing is sent to a model until the last step,
// when one call pulls the stories out of everything you said.
//
// The questions are fixed, so this is a form, not a conversation: the applicant is describing
// someone else's view of them, and a fixed list gets there faster than a turn-taking interview.

import { INTAKE_QUESTIONS, type IntakeQuestionId } from "@admitstory/shared/kit";
import { useState, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";

export interface IntakeAnswerInput {
  questionId: IntakeQuestionId;
  text: string;
  spoken?: { seconds: number; language: string };
}

export interface IntakePanelProps {
  firstName: string;
  /** Answers already stored, shown so nothing is said twice. */
  given: readonly { id: string; questionId: IntakeQuestionId; text: string; spoken: boolean }[];
  /** The record button, supplied by the route so the dictation code loads only on first press. */
  renderRecorder?: (
    onDictated: (text: string, seconds: number, language: string) => void,
  ) => ReactNode;
  onSubmit: (answers: IntakeAnswerInput[]) => void;
  /** "Pull out the stories" is running. */
  working?: boolean;
  /** Why the stories can't be pulled out (no active kit), or null. */
  blockedReason?: string | null;
  className?: string;
}

export function IntakePanel({
  firstName,
  given,
  renderRecorder,
  onSubmit,
  working = false,
  blockedReason = null,
  className,
}: IntakePanelProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswerInput[]>([]);
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState<{ seconds: number; language: string } | null>(null);

  const question = INTAKE_QUESTIONS[step];
  const last = step === INTAKE_QUESTIONS.length - 1;
  if (!question) return null;

  const kept = (): IntakeAnswerInput[] => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return answers;
    return [...answers, { questionId: question.id, text: trimmed, ...(spoken ? { spoken } : {}) }];
  };

  const clear = () => {
    setText("");
    setSpoken(null);
  };

  const go = (next: number) => {
    setAnswers(kept());
    clear();
    setStep(next);
  };

  const answersFor = (id: IntakeQuestionId) => [
    ...given.filter((answer) => answer.questionId === id).map((answer) => answer.text),
    ...answers.filter((answer) => answer.questionId === id).map((answer) => answer.text),
  ];

  const already = answersFor(question.id);

  return (
    <div className={cx("flex flex-col gap-5", className)}>
      <p className="text-sm tabular-nums text-text-soft">
        Question {step + 1} of {INTAKE_QUESTIONS.length}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="max-w-essay font-reading text-read-lg text-text">
          {question.prompt(firstName)}
        </h3>
        <p className="text-text-soft">{question.hint}</p>
      </div>

      {already.length > 0 ? (
        <ul className="flex flex-col gap-2 border-l-2 border-edge pl-3">
          {already.map((answer, index) => (
            <li key={`${answer.slice(0, 24)}-${index}`} className="text-sm text-text-soft">
              {answer}
            </li>
          ))}
        </ul>
      ) : null}

      {renderRecorder ? (
        <div className="flex flex-col items-start gap-2">
          {renderRecorder((said, seconds, language) => {
            setText((current) => (current ? `${current} ${said}` : said));
            setSpoken({ seconds, language });
          })}
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Your answer</span>
        <textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Say it or type it. Rough is fine."
          className="min-h-11 w-full resize-y rounded-control border border-control bg-depth px-3 py-2 text-lg text-text placeholder:text-text-soft sm:text-base"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {question.repeatable ? (
          <Button
            variant="secondary"
            onClick={() => {
              setAnswers(kept());
              clear();
            }}
            disabled={text.trim().length === 0}
          >
            Add another story
          </Button>
        ) : null}
        {last ? (
          <Button
            onClick={() => {
              const all = kept();
              setAnswers(all);
              clear();
              onSubmit(all);
            }}
            disabled={working || blockedReason !== null || kept().length === 0}
          >
            {working ? "Pulling out the stories" : "Pull out the stories"}
          </Button>
        ) : (
          <Button onClick={() => go(step + 1)}>Next question</Button>
        )}
        {!last ? (
          <Button
            variant="quiet"
            onClick={() => {
              clear();
              setStep(step + 1);
            }}
          >
            Skip for now
          </Button>
        ) : null}
        {step > 0 ? (
          <Button variant="quiet" onClick={() => go(step - 1)}>
            Back
          </Button>
        ) : null}
      </div>

      {blockedReason ? <p className="text-text-soft">{blockedReason}</p> : null}
    </div>
  );
}
