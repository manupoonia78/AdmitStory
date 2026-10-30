"use client";

import { Button, FieldHint, ImmersiveScope, TextField, VoiceprintStill, cx } from "@admitstory/ui";
import { DEFAULT_IDENTITY } from "@admitstory/shared";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { AlertMessage } from "@/components/live-message";
import { completeFirstRun, type FirstRunInput } from "./actions";
import { UploadStep } from "./upload-step";

// First run (spec §5.1): four screens, one question each, under a minute.
//
// The hero moment is §6.7's: "the Voiceprint is born — a faint seed that grows brighter as you
// answer the four first-run questions." It is the still SVG form rather than the live renderer,
// because nobody has spoken yet and a WebGL context on the first screen after sign-up would cost
// more than it shows.

const STEPS = ["applying", "where", "bring", "time"] as const;
type Step = (typeof STEPS)[number];

const INTAKES = [2027, 2028] as const;

const ROUNDS = [
  { id: "R1", label: "Round 1" },
  { id: "R2", label: "Round 2" },
  { id: "R3", label: "Round 3" },
  { id: "unsure", label: "Not sure yet" },
] as const;

const MODES = [
  {
    id: "express",
    label: "Express",
    minutes: "about 20 minutes",
    detail: "Your story in broad strokes, then only the gaps. Enough for a first draft.",
  },
  {
    id: "standard",
    label: "Standard",
    minutes: "about 45 minutes",
    detail: "The whole arc, with time to go deeper where it matters.",
  },
  {
    id: "deep",
    label: "Deep",
    minutes: "60 to 90 minutes",
    detail: "Everything, across as many sittings as you like. Nothing is ever lost.",
  },
] as const;

export interface FirstRunFlowProps {
  defaults: {
    programType: string;
    targetIntake: number | null;
    country: string | null;
    timezone: string | null;
  };
}

export function FirstRunFlow({ defaults }: FirstRunFlowProps) {
  const [step, setStep] = useState<Step>("applying");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstLoad = useRef(true);

  // The time zone the browser is actually in, offered rather than imposed (spec §5.1). Read as an
  // external value rather than set in an effect, so the server renders nothing and the browser
  // fills it in on hydration without a cascade or a mismatch.
  const detectedTimezone = useSyncExternalStore(subscribeNever, readTimezone, readNoTimezone);

  const [answers, setAnswers] = useState<FirstRunInput>({
    targetIntake: defaults.targetIntake ?? INTAKES[0],
    programType: defaults.programType || "full_time_mba",
    targetRounds: [],
    country: defaults.country,
    timezone: defaults.timezone ?? "",
    currentRole: "",
    studioMode: "standard",
  });

  // Moving between screens moves focus to the new question, so a screen reader and the keyboard
  // land in the same place (WCAG 2.4.3). Not on first paint, where focus belongs at the top.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const index = STEPS.indexOf(step);
  const progress = (index + 1) / STEPS.length;

  const goNext = () => {
    const next = STEPS[index + 1];
    if (next) setStep(next);
  };

  const submit = () => {
    setError("");
    start(async () => {
      const result = await completeFirstRun({
        ...answers,
        timezone: answers.timezone || detectedTimezone,
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <ImmersiveScope className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
        <Seed progress={progress} />

        <ol className="flex items-center gap-2" aria-label="Progress">
          {STEPS.map((id, position) => (
            <li
              key={id}
              aria-current={id === step ? "step" : undefined}
              className={cx(
                "h-0.5 flex-1 rounded-full transition-colors duration-(--spring-glide-duration) ease-glide",
                position <= index ? "bg-signal" : "bg-edge",
              )}
            >
              <span className="sr-only">
                {`Step ${position + 1} of ${STEPS.length}`}
                {id === step ? " (current)" : ""}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-1 flex-col gap-8">
          {step === "applying" ? (
            <Screen
              ref={headingRef}
              title="What are you applying for?"
              hint="You can change any of this later."
            >
              <Choices
                legend="Intake year"
                options={INTAKES.map((year) => ({ id: String(year), label: String(year) }))}
                value={String(answers.targetIntake)}
                onChange={(value) => setAnswers({ ...answers, targetIntake: Number(value) })}
              />
              <Choices
                legend="Program"
                options={[
                  { id: "full_time_mba", label: "Full-time MBA" },
                  { id: "other", label: "Something else" },
                ]}
                value={answers.programType === "full_time_mba" ? "full_time_mba" : "other"}
                onChange={(value) => setAnswers({ ...answers, programType: value })}
                hint={
                  answers.programType === "other"
                    ? "Other programs come later; for now the advice is written for full-time MBA applications."
                    : undefined
                }
              />
              <Choices
                legend="Rounds, if you know"
                multiple
                options={ROUNDS.map((round) => ({ id: round.id, label: round.label }))}
                values={answers.targetRounds}
                onToggle={(id) =>
                  setAnswers({
                    ...answers,
                    targetRounds: answers.targetRounds.includes(
                      id as FirstRunInput["targetRounds"][number],
                    )
                      ? answers.targetRounds.filter((round) => round !== id)
                      : [...answers.targetRounds, id as FirstRunInput["targetRounds"][number]],
                  })
                }
              />
              <Actions onNext={goNext} nextLabel="Next" />
            </Screen>
          ) : null}

          {step === "where" ? (
            <Screen ref={headingRef} title="Where are you right now?">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Country"
                  hint="Two-letter code, like IN, NG, BR or US."
                  value={answers.country ?? ""}
                  maxLength={2}
                  autoComplete="country"
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      country: event.target.value.toUpperCase().slice(0, 2) || null,
                    })
                  }
                />
                <TextField
                  label="Time zone"
                  hint="Detected from your browser. Change it if it's wrong."
                  value={answers.timezone || detectedTimezone}
                  onChange={(event) => setAnswers({ ...answers, timezone: event.target.value })}
                />
              </div>
              <TextField
                label="Your current role, in one line"
                hint="Optional."
                value={answers.currentRole}
                maxLength={200}
                placeholder="Senior product lead at a US health system"
                onChange={(event) => setAnswers({ ...answers, currentRole: event.target.value })}
              />
              <Actions onBack={() => setStep("applying")} onNext={goNext} nextLabel="Next" />
            </Screen>
          ) : null}

          {step === "bring" ? (
            <Screen
              ref={headingRef}
              title="Bring what you have"
              hint="A CV, a LinkedIn export, past essays, any notes. All optional — we read them so you're never asked for what they already say."
            >
              <UploadStep />
              <Actions
                onBack={() => setStep("where")}
                onNext={goNext}
                nextLabel="Next"
                skipLabel="Skip for now"
                onSkip={goNext}
              />
            </Screen>
          ) : null}

          {step === "time" ? (
            <Screen ref={headingRef} title="How much time do you have today?">
              <div className="flex flex-col gap-3">
                {MODES.map((mode) => {
                  const selected = answers.studioMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswers({ ...answers, studioMode: mode.id })}
                      className={cx(
                        "flex min-h-11 flex-col gap-1 rounded-plane border p-4 text-left",
                        selected
                          ? "border-signal bg-veil"
                          : "border-edge hover:border-control-edge hover:bg-veil",
                      )}
                    >
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-text">{mode.label}</span>
                        <span className="text-sm text-text-soft">{mode.minutes}</span>
                      </span>
                      <span className="text-sm text-text-soft">{mode.detail}</span>
                    </button>
                  );
                })}
              </div>
              <AlertMessage message={error} />
              <Actions
                onBack={() => setStep("bring")}
                onNext={submit}
                nextLabel={pending ? "Starting…" : "Start talking"}
                nextDisabled={pending}
              />
            </Screen>
          ) : null}
        </div>
      </div>
    </ImmersiveScope>
  );
}

/** The Voiceprint being born (spec §6.7): fainter at the start, brighter with every answer. */
function Seed({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className="transition-opacity duration-(--spring-drift-duration) ease-drift"
        style={{ opacity: 0.25 + progress * 0.75 }}
      >
        <VoiceprintStill identity={DEFAULT_IDENTITY} size={56} mood="seed" label="" />
      </span>
      <p className="text-sm text-text-soft">
        This becomes your Voiceprint — drawn from the way you actually talk.
      </p>
    </div>
  );
}

function Screen({
  ref,
  title,
  hint,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={ref} tabIndex={-1} className="text-display-sm text-text outline-none">
          {title}
        </h1>
        {hint ? <p className="max-w-prose text-text-soft">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface ChoiceOption {
  id: string;
  label: string;
}

function Choices(
  props: {
    legend: string;
    options: readonly ChoiceOption[];
    hint?: string;
  } & (
    | { multiple?: false; value: string; onChange: (id: string) => void }
    | { multiple: true; values: readonly string[]; onToggle: (id: string) => void }
  ),
) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-text">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => {
          const selected = props.multiple
            ? props.values.includes(option.id)
            : props.value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                props.multiple ? props.onToggle(option.id) : props.onChange(option.id)
              }
              className={cx(
                "min-h-11 rounded-control border px-4 text-sm",
                selected
                  ? "border-signal bg-veil font-semibold text-text"
                  : "border-control-edge text-text-soft hover:bg-veil hover:text-text",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {props.hint ? <FieldHint>{props.hint}</FieldHint> : null}
    </fieldset>
  );
}

function Actions({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  skipLabel,
  onSkip,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
      {skipLabel && onSkip ? (
        <Button variant="quiet" onClick={onSkip}>
          {skipLabel}
        </Button>
      ) : null}
      {onBack ? (
        <Button variant="quiet" onClick={onBack} className="ms-auto">
          Back
        </Button>
      ) : null}
    </div>
  );
}

/* The browser's time zone, as an external value (see above). */
const subscribeNever = () => () => {};
const readTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const readNoTimezone = () => "";
