"use client";

import { APP_NAME } from "@admitstory/shared";
import {
  Button,
  DEFAULT_IDENTITY,
  FieldErrorRegion,
  FieldHint,
  IDENTITY_SAMPLE_SECONDS,
  Label,
  VOICE_HUES,
  Voiceprint,
  VoiceprintStill,
  createIdentityAccumulator,
  cx,
  identityFromText,
  paramsFromIdentity,
  useMicrophone,
  useTierDetails,
  voiceHueAt,
  voiceHueStyle,
  type AnalysisFrame,
  type IdentityAccumulator,
  type PerformanceTier,
  type VoiceprintIdentity,
  type VoiceprintMood,
} from "@admitstory/ui";
import {
  ArrowCounterClockwiseIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PencilSimpleLineIcon,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { StatusMessage } from "@/components/live-message";
import { usePrototypeIdentity } from "../_shared/identity";
import {
  SAMPLE_ANSWERS,
  TIER_NAMES,
  describePauseRhythm,
  describeSource,
  formatClock,
  microphoneMessage,
  splitAnswers,
  tierSummary,
} from "./lab-model";

type TierChoice = "auto" | PerformanceTier;

const MOODS: { value: VoiceprintMood; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "speaking", label: "Speaking" },
  { value: "listening", label: "Listening" },
  { value: "seed", label: "Seed" },
];

const SAMPLE_POLL_MS = 250;

/**
 * The Voiceprint review lab (spec §6.2, §6.11, §16 Phase 0.5): the live form driven by the
 * microphone, a three-minute identity sample, the writing path, every hue, and switches for tier,
 * mood and tone. Whatever identity it settles on is saved for the other prototypes.
 */
export function VoiceprintLab() {
  const [identity, setIdentity, hueIndex, setHue] = usePrototypeIdentity();
  const [tierChoice, setTierChoice] = useState<TierChoice>("auto");
  const [mood, setMood] = useState<VoiceprintMood>("idle");
  const [tone, setTone] = useState<"voice" | "silver">("voice");
  const [announcement, setAnnouncement] = useState("");
  const writing = useRef<HTMLTextAreaElement>(null);
  const tiers = useTierDetails();

  // The sample: frames go straight from the microphone into the accumulator, never into state.
  const accumulator = useRef<IdentityAccumulator | null>(null);
  const recording = useRef(false);
  const onFrame = useCallback((frame: AnalysisFrame) => {
    if (recording.current) accumulator.current?.add(frame);
  }, []);
  const mic = useMicrophone({ onFrame });
  const [sample, setSample] = useState({ active: false, speechSeconds: 0, usable: false });

  const saveIdentity = useCallback(
    (next: VoiceprintIdentity, message: string) => {
      setIdentity(next);
      // The new identity brings its own hue.
      setHue(null);
      setAnnouncement(message);
    },
    [setHue, setIdentity],
  );

  const finishSample = useCallback(() => {
    const current = accumulator.current;
    recording.current = false;
    setSample((s) => ({ ...s, active: false }));
    const heard = current?.identity();
    if (current && heard) {
      saveIdentity(
        heard,
        `Voiceprint saved from ${formatClock(current.snapshot().speechSeconds)} of speech.`,
      );
    }
  }, [saveIdentity]);

  useEffect(() => {
    if (!sample.active) return;
    const timer = window.setInterval(() => {
      const snapshot = accumulator.current?.snapshot();
      if (!snapshot) return;
      setSample((s) => ({ ...s, speechSeconds: snapshot.speechSeconds, usable: snapshot.usable }));
      if (snapshot.done) finishSample();
    }, SAMPLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [sample.active, finishSample]);

  const startSample = () => {
    accumulator.current = createIdentityAccumulator();
    recording.current = true;
    setSample({ active: true, speechSeconds: 0, usable: false });
    setAnnouncement("");
    if (mic.status !== "live") void mic.start();
  };

  const cancelSample = () => {
    recording.current = false;
    accumulator.current = null;
    setSample({ active: false, speechSeconds: 0, usable: false });
    setAnnouncement("Sample cancelled. Your Voiceprint hasn't changed.");
  };

  const micFailed =
    mic.status === "denied" || mic.status === "unsupported" || mic.status === "error";
  // A sample only runs while the microphone can hear it.
  const sampling = sample.active && !micFailed;
  const writeInstead = () => writing.current?.focus();

  const params = paramsFromIdentity(identity);
  const ownHue = params.hueIndex;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 sm:px-8 sm:py-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <section
          aria-labelledby="voiceprint-title"
          className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start"
        >
          <h1 id="voiceprint-title" className="text-display-sm text-text">
            Your Voiceprint
          </h1>
          <div className="mx-auto aspect-square w-full max-w-xl">
            <Voiceprint
              identity={identity}
              signal={mic.signal}
              mood={mood}
              tone={tone}
              size="fill"
              label="Your Voiceprint"
              {...(tierChoice === "auto" ? {} : { tier: tierChoice })}
            />
          </div>
          <MicrophonePanel
            status={mic.status}
            onAllow={() => void mic.start()}
            onStop={mic.stop}
            onWriteInstead={writeInstead}
          />
        </section>

        <div className="flex flex-col gap-12">
          <LabSection id="sample" title="A three-minute sample">
            <p className="text-text-soft">
              Talk about anything: your first job, a place you know well. Only speech counts, so
              pauses are fine. Nothing is recorded; when you stop, four numbers are kept in this
              browser.
            </p>
            {sampling ? (
              <SampleProgress
                speechSeconds={sample.speechSeconds}
                usable={sample.usable}
                listening={mic.status === "live"}
                onUseWhatIHave={finishSample}
                onCancel={cancelSample}
              />
            ) : (
              <Button icon={MicrophoneIcon} onClick={startSample} className="self-start">
                Record a 3-minute sample
              </Button>
            )}
            <StatusMessage message={announcement} />
          </LabSection>

          <IdentityReadout
            identity={identity}
            hueIndex={hueIndex}
            ownHue={ownHue}
            onReset={() =>
              saveIdentity(DEFAULT_IDENTITY, "Voiceprint reset to the default identity.")
            }
          />

          <LabSection id="review" title="Review controls">
            <Segmented
              legend="Performance tier"
              hint={tierChoice === "auto" ? tierSummary(tiers) : undefined}
              value={String(tierChoice)}
              onChange={(value) =>
                setTierChoice(value === "auto" ? "auto" : (Number(value) as PerformanceTier))
              }
              options={[
                { value: "auto", label: `Automatic (${tiers.tier})` },
                { value: "1", label: `1 ${TIER_NAMES[1]}` },
                { value: "2", label: `2 ${TIER_NAMES[2]}` },
                { value: "3", label: `3 ${TIER_NAMES[3]}` },
              ]}
            />
            <Segmented
              legend="Mood"
              value={mood}
              onChange={(value) => setMood(value as VoiceprintMood)}
              options={MOODS}
            />
            <Segmented
              legend="Colour"
              value={tone}
              onChange={(value) => setTone(value as "voice" | "silver")}
              options={[
                { value: "voice", label: "Your hue" },
                { value: "silver", label: "Interviewer silver" },
              ]}
            />
          </LabSection>

          <WritingSeed
            textarea={writing}
            onSeed={(answers) =>
              saveIdentity(identityFromText(answers), "Voiceprint seeded from your writing.")
            }
          />
        </div>
      </div>

      <HueGallery
        identity={identity}
        hueIndex={hueIndex}
        ownHue={ownHue}
        onPick={(index) => {
          setHue(index === ownHue ? null : index);
          setAnnouncement(`${voiceHueAt(index).name} hue chosen.`);
        }}
      />
    </div>
  );
}

function LabSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MicrophonePanel({
  status,
  onAllow,
  onStop,
  onWriteInstead,
}: {
  status: ReturnType<typeof useMicrophone>["status"];
  onAllow: () => void;
  onStop: () => void;
  onWriteInstead: () => void;
}) {
  const asking = status === "idle" || status === "requesting";
  return (
    <div className="flex flex-col gap-4">
      {/* Polite, and always in the tree, so a change of state is read out. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-2">
        <p className="max-w-prose text-text">
          {status === "live" ? (
            <span
              aria-hidden
              className="mr-2 inline-block size-2.5 rounded-full bg-record align-middle"
            />
          ) : null}
          {microphoneMessage(status, APP_NAME)}
        </p>
        {asking ? (
          <p className="max-w-prose text-sm text-text-soft">
            In this prototype nothing is turned into text or kept: the form only listens.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {asking ? (
          <Button icon={MicrophoneIcon} onClick={onAllow} loading={status === "requesting"}>
            {status === "requesting" ? "Waiting for permission" : "Allow microphone"}
          </Button>
        ) : null}
        {status === "live" ? (
          <Button icon={MicrophoneSlashIcon} variant="secondary" onClick={onStop}>
            Turn off microphone
          </Button>
        ) : null}
        {status === "error" ? (
          <Button icon={MicrophoneIcon} onClick={onAllow}>
            Try the microphone again
          </Button>
        ) : null}
        {status !== "live" ? (
          <Button icon={PencilSimpleLineIcon} variant="secondary" onClick={onWriteInstead}>
            Write instead
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SampleProgress({
  speechSeconds,
  usable,
  listening,
  onUseWhatIHave,
  onCancel,
}: {
  speechSeconds: number;
  usable: boolean;
  listening: boolean;
  onUseWhatIHave: () => void;
  onCancel: () => void;
}) {
  const hintId = useId();
  const progress = Math.min(1, speechSeconds / IDENTITY_SAMPLE_SECONDS);
  const total = formatClock(IDENTITY_SAMPLE_SECONDS);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="flex items-center gap-2 font-medium text-text">
          <span aria-hidden className="size-2.5 rounded-full bg-record" />
          {listening ? "Recording" : "Waiting for the microphone"}
        </span>
        <span className="text-text-soft tabular-nums">
          {formatClock(speechSeconds)} of {total} of speech
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Speech sampled"
        aria-valuemin={0}
        aria-valuemax={IDENTITY_SAMPLE_SECONDS}
        aria-valuenow={Math.floor(speechSeconds)}
        aria-valuetext={`${formatClock(speechSeconds)} of ${total}`}
        className="h-2 w-full overflow-hidden rounded-full border border-edge bg-veil"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-text-soft transition-transform duration-(--spring-glide-duration) ease-glide motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={onUseWhatIHave}
          disabled={!usable}
          aria-describedby={usable ? undefined : hintId}
        >
          Use what I have
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel sample
        </Button>
      </div>
      {usable ? null : (
        <FieldHint id={hintId}>Keep talking: it needs at least 10 seconds of speech.</FieldHint>
      )}
    </div>
  );
}

function IdentityReadout({
  identity,
  hueIndex,
  ownHue,
  onReset,
}: {
  identity: VoiceprintIdentity;
  hueIndex: number;
  ownHue: number;
  onReset: () => void;
}) {
  const params = paramsFromIdentity(identity);
  const rows: [string, string][] = [
    ["Source", describeSource(identity.source)],
    ["Average pitch", `${identity.avgPitchHz.toFixed(0)} Hz`],
    ["Pace", `${identity.paceWpm} words a minute, estimated`],
    ["Pitch range", `${identity.pitchRangeSemitones.toFixed(1)} semitones`],
    [
      "Pause rhythm",
      `${identity.pauseRhythm.toFixed(2)}, ${describePauseRhythm(identity.pauseRhythm)}`,
    ],
    ["Hue", `${voiceHueAt(hueIndex).name}${hueIndex === ownHue ? "" : ", chosen by hand"}`],
    ["Filaments", String(params.filamentCount)],
    ["Swirl speed", params.swirlSpeed.toFixed(2)],
    ["Asymmetry", params.asymmetry.toFixed(2)],
  ];
  return (
    <LabSection id="identity" title="What it heard">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-edge pt-4 tabular-nums">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-text-soft">{term}</dt>
            <dd className="text-text">{value}</dd>
          </div>
        ))}
      </dl>
      {identity.source === "default" ? null : (
        <Button
          variant="quiet"
          icon={ArrowCounterClockwiseIcon}
          onClick={onReset}
          className="self-start"
        >
          Reset to the default identity
        </Button>
      )}
    </LabSection>
  );
}

function WritingSeed({
  textarea,
  onSeed,
}: {
  textarea: RefObject<HTMLTextAreaElement | null>;
  onSeed: (answers: string[]) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const answers = splitAnswers(text);
    if (answers.length === 0) {
      setError("Write or paste at least one sentence first.");
      textarea.current?.focus();
      return;
    }
    setError(undefined);
    onSeed(answers);
  };
  return (
    <LabSection id="writing" title="Seed from writing">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={id}>Your written answers</Label>
          <FieldHint id={`${id}-hint`}>
            Paste two or three answers, with a blank line between them. Sentence rhythm stands in
            for your voice, and the text isn&rsquo;t kept.
          </FieldHint>
          <textarea
            ref={textarea}
            id={id}
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={cx(`${id}-hint`, error && `${id}-error`)}
            className="min-h-40 w-full resize-y rounded-control border border-control bg-depth px-3 py-2 font-reading text-read text-text placeholder:text-text-soft aria-invalid:border-risk"
          />
          <FieldErrorRegion id={`${id}-error`} error={error} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="secondary">
            Seed my Voiceprint from writing
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setText(SAMPLE_ANSWERS);
              setError(undefined);
            }}
          >
            Fill in sample answers
          </Button>
        </div>
      </form>
    </LabSection>
  );
}

function HueGallery({
  identity,
  hueIndex,
  ownHue,
  onPick,
}: {
  identity: VoiceprintIdentity;
  hueIndex: number;
  ownHue: number;
  onPick: (index: number) => void;
}) {
  return (
    <section aria-labelledby="hues-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="hues-title" className="text-lg font-semibold text-text">
          Twelve hues
        </h2>
        <p className="max-w-prose text-text-soft">
          The same Voiceprint in each tuned hue, as stills. Pick one to try it across the
          prototypes; the hue that came from your voice is marked.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {VOICE_HUES.map((hue, index) => (
          <li key={hue.id}>
            <button
              type="button"
              aria-pressed={hueIndex === index}
              onClick={() => onPick(index)}
              className="flex w-full flex-col items-center gap-3 rounded-plane border border-transparent p-3 text-sm transition-colors duration-(--spring-snap-duration) ease-snap hover:bg-veil aria-pressed:border-control aria-pressed:bg-veil"
            >
              <span style={voiceHueStyle(index)} className="block size-24">
                <VoiceprintStill identity={identity} size="fill" label="" />
              </span>
              <span className="font-medium text-text">{hue.name}</span>
              <span className="text-text-soft">
                {index === ownHue ? "From your voice" : "\u00a0"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A row of native radios styled as one control: arrow keys and forms work as usual. */
function Segmented({
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string | undefined;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hint ? `${name}-hint` : undefined}>
      <legend className="mb-2 text-base font-medium text-text">{legend}</legend>
      <div className="inline-flex flex-wrap gap-1 self-start rounded-control border border-control bg-depth p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-control px-3 text-sm font-medium text-text-soft transition-colors duration-(--spring-snap-duration) ease-snap hover:text-text has-checked:bg-veil has-checked:font-semibold has-checked:text-signal has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? (
        <FieldHint id={`${name}-hint`} className="max-w-prose">
          {hint}
        </FieldHint>
      ) : null}
    </fieldset>
  );
}
