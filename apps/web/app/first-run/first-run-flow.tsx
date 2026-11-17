"use client";

import { Button, FieldHint, TextField, cx } from "@admitstory/ui";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
} from "react";
import { KEEP_LINE_COPY } from "@/app/(marketing)/_copy/keep-line";
import { AlertMessage } from "@/components/live-message";
import { clearFirstLine, readFirstLine, subscribeFirstLine } from "@/lib/marketing/first-line";
import { completeFirstRun, type FirstRunInput } from "./actions";
import { UploadStep } from "./upload-step";

// First run (spec §5.1): five screens, one question each, about a minute. The second asks which
// schools they are aiming for (16 Nov 2026), so the free steps after it can point at a real one.
//
// It renders inside the entry room (components/auth-shell.tsx; SPEC §5). Its one moment is the
// progress line: brass up to the current step, with the mark's peak standing on it and travelling
// to the next stop on Next and Back (components/entry.css, .fr-progress). The Voiceprint orb is
// gone: the line is the form.

const STEP_NAMES: Record<string, string> = {
  applying: "Applying",
  schools: "Schools",
  where: "Where",
  bring: "Bring",
  time: "Time",
};

const STEPS = ["applying", "schools", "where", "bring", "time"] as const;
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
  /** Schools with a published pack, by name. With none, the schools screen is left out. */
  schools: readonly { cycleId: string; name: string }[];
  defaults: {
    programType: string;
    targetIntake: number | null;
    country: string | null;
    timezone: string | null;
  };
}

export function FirstRunFlow({ defaults, schools }: FirstRunFlowProps) {
  const steps: readonly Step[] =
    schools.length > 0 ? STEPS : STEPS.filter((id) => id !== "schools");
  const [step, setStep] = useState<Step>("applying");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstLoad = useRef(true);

  // The time zone the browser is actually in, offered rather than imposed (spec §5.1). Read as an
  // external value rather than set in an effect, so the server renders nothing and the browser
  // fills it in on hydration without a cascade or a mismatch.
  const detectedTimezone = useSyncExternalStore(subscribeNever, readTimezone, readNoTimezone);

  // The line said on our homepage, kept in this browser for 24 hours (plan §5). Once sent (or
  // declined) it leaves storage at once; `heldLine` keeps it on screen, and in a retry, until the
  // action finishes.
  const storedLine = useSyncExternalStore(subscribeFirstLine, readFirstLine, readNoLine);
  const [heldLine, setHeldLine] = useState<string | null>(null);
  const homepageLine = heldLine ?? storedLine?.line ?? null;
  const [keepLine, setKeepLine] = useState(true);

  const [answers, setAnswers] = useState<FirstRunInput>({
    targetIntake: defaults.targetIntake ?? INTAKES[0],
    programType: defaults.programType || "full_time_mba",
    targetRounds: [],
    country: defaults.country,
    timezone: defaults.timezone ?? "",
    currentRole: "",
    studioMode: "standard",
    schoolCycleIds: [],
  });
  const chosen = answers.schoolCycleIds ?? [];

  // Moving between screens moves focus to the new question, so a screen reader and the keyboard
  // land in the same place (WCAG 2.4.3). Not on first paint, where focus belongs at the top.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const index = steps.indexOf(step);

  const goNext = () => {
    const next = steps[index + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const previous = steps[index - 1];
    if (previous) setStep(previous);
  };

  const submit = () => {
    setError("");
    const firstLine = homepageLine && keepLine ? homepageLine : undefined;
    if (homepageLine) {
      setHeldLine(homepageLine);
      clearFirstLine();
    }
    start(async () => {
      const result = await completeFirstRun({
        ...answers,
        timezone: answers.timezone || detectedTimezone,
        ...(firstLine ? { firstLine } : {}),
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-14 lg:mx-0">
      <Progress steps={steps} index={index} />

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

        {step === "schools" ? (
          <Screen
            ref={headingRef}
            title="Which schools are you aiming for?"
            hint="Pick any you're considering. Each one gets a free preview built from your stories, and you can change the list at any time."
          >
            <Choices
              legend="Schools we have a pack for"
              multiple
              options={schools.map((school) => ({ id: school.cycleId, label: school.name }))}
              values={chosen}
              onToggle={(id) =>
                setAnswers({
                  ...answers,
                  schoolCycleIds: chosen.includes(id)
                    ? chosen.filter((cycleId) => cycleId !== id)
                    : [...chosen, id],
                })
              }
              hint="Aiming somewhere else too? Add any school from Schools later; we build packs by demand."
            />
            <Actions
              onBack={goBack}
              onNext={goNext}
              nextLabel={chosen.length > 0 ? "Next" : "Not sure yet"}
            />
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
            <Actions onBack={goBack} onNext={goNext} nextLabel="Next" />
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
              onBack={goBack}
              onNext={goNext}
              nextLabel="Next"
              skipLabel="Skip for now"
              onSkip={goNext}
            />
          </Screen>
        ) : null}

        {step === "time" ? (
          <Screen ref={headingRef} title="How much time do you have today?">
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((mode) => {
                const selected = answers.studioMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAnswers({ ...answers, studioMode: mode.id })}
                    className={cx(
                      "flex min-h-11 flex-col gap-2 rounded-card border p-6 text-left transition-colors duration-(--dur-hover)",
                      selected ? "border-text bg-frost" : "border-edge bg-veil hover:bg-frost",
                    )}
                  >
                    <span className="text-title text-text">{mode.label}</span>
                    <span className="label">{mode.minutes}</span>
                    <span className="mt-1 text-sm text-text-soft">{mode.detail}</span>
                  </button>
                );
              })}
            </div>
            {homepageLine ? (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-edge p-5 hover:bg-veil">
                <input
                  type="checkbox"
                  checked={keepLine}
                  onChange={(event) => setKeepLine(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-text"
                />
                <span className="flex flex-col gap-2">
                  <span className="text-text">{KEEP_LINE_COPY.firstRunCheckbox}</span>
                  <span className="font-accent text-[1.375rem] leading-[1.25] text-text-80 italic">
                    “{homepageLine}”
                  </span>
                </span>
              </label>
            ) : null}
            <AlertMessage message={error} />
            <Actions
              onBack={goBack}
              onNext={submit}
              nextLabel={pending ? "Starting…" : "Start talking"}
              nextDisabled={pending}
            />
          </Screen>
        ) : null}
      </div>
    </div>
  );
}

/** The progress line (SPEC §5): a tick at each stop, brass to the current one, the peak on it. */
function Progress({ steps, index }: { steps: readonly Step[]; index: number }) {
  const last = Math.max(steps.length - 1, 1);
  const current = steps[index] ?? steps[0];
  return (
    <div className="flex flex-col gap-4">
      <p className="label" aria-hidden="true">
        {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} ·{" "}
        {current ? STEP_NAMES[current] : null}
      </p>
      <div className="fr-progress" style={{ "--p": index / last } as CSSProperties}>
        <span className="fr-progress-line" />
        <span className="fr-progress-brass" />
        {steps.map((id, position) => (
          <span
            key={id}
            className="fr-progress-tick"
            style={{ left: `${(position / last) * 100}%` }}
          />
        ))}
        <svg className="fr-progress-peak" viewBox="0 0 24 34" fill="none" aria-hidden="true">
          <path d="M0 33.5 L12 1 L24 33.5" />
        </svg>
      </div>
      <ol className="sr-only" aria-label="Progress">
        {steps.map((id, position) => (
          <li key={id} aria-current={id === step(index, steps) ? "step" : undefined}>
            {`Step ${position + 1} of ${steps.length}`}
            {position === index ? " (current)" : ""}
          </li>
        ))}
      </ol>
      <p className="text-sm text-text-soft">
        This becomes your Voiceprint: drawn from the way you actually talk.
      </p>
    </div>
  );
}

const step = (index: number, steps: readonly Step[]) => steps[index];

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
        <h1 ref={ref} tabIndex={-1} className="font-display text-display-2 text-text outline-none">
          {title}
        </h1>
        {hint ? <p className="max-w-[60ch] text-text-soft">{hint}</p> : null}
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
    <fieldset className="flex flex-col gap-3">
      <legend className="label mb-3">{props.legend}</legend>
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
                "inline-flex min-h-11 items-center rounded-full border px-5 text-ui transition-colors duration-(--dur-hover)",
                selected
                  ? "border-text bg-text text-space"
                  : "border-edge bg-frost text-text hover:bg-frost-hover",
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
      <Button onClick={onNext} disabled={nextDisabled} arrow>
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
const readNoLine = () => null;
const readNoTimezone = () => "";
