"use client";

import { buttonStyles } from "@admitstory/ui";
import {
  SPEECH_LANGUAGES,
  TTS_SPEEDS,
  TTS_VOICES,
  type SpeechLanguage,
  type TtsSpeed,
  type TtsVoice,
  type VoiceSettings,
} from "@admitstory/voice/contract";
import type { ReadAloudPlayer } from "@admitstory/voice/client";
import { useEffect, useId, useRef, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";

// Settings → Voice (spec §5.1): read questions aloud, the interviewer's voice and speed, and the
// language the applicant speaks in. Each change saves on its own through PATCH /api/profile/voice.
// Keeping raw recordings is not offered: nothing is kept in this phase, so there is no switch.
// The read-aloud player is loaded on the first "Play a sample", never with the page, and the sample
// button is a plain button in Button's style: Button's Slot and the icons would be 3.5 KB of a
// route near §6.11's 160 KB budget.

/** §6.9's first Studio question: what the interviewer will actually sound like. */
export const SAMPLE_QUESTION =
  "Let's start before your first job. Where did you grow up, and what was home like?";

export const SPEED_LABELS: Record<TtsSpeed, string> = {
  0.85: "Slower",
  1: "Normal",
  1.15: "Faster",
};

type AudioContextConstructor = typeof AudioContext;

function newAudioContext(): AudioContext | null {
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextConstructor })
    .webkitAudioContext;
  const Context = window.AudioContext ?? legacy;
  return Context ? new Context() : null;
}

export function VoiceSettingsForm({
  initial,
  emailVerified,
}: {
  initial: VoiceSettings;
  emailVerified: boolean;
}) {
  const id = useId();
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const player = useRef<ReadAloudPlayer | null>(null);
  const context = useRef<AudioContext | null>(null);

  useEffect(() => () => player.current?.dispose(), []);

  const save = async (patch: Partial<VoiceSettings>, note: string) => {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/profile/voice", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSettings((await response.json()) as VoiceSettings);
      setStatus(note);
    } catch {
      setSettings(previous);
      setError("That setting didn't save. Check your connection, then try again.");
    }
  };

  const playSample = async () => {
    if (playing) {
      player.current?.stop();
      return;
    }
    setError("");
    // Made inside the click, so iOS Safari lets it play once the player has loaded.
    context.current ??= newAudioContext();
    const audio = context.current;
    if (!audio) {
      setError("This browser can't play audio from this page.");
      return;
    }
    void audio.resume().catch(() => {});
    setPlaying(true);
    try {
      const { createReadAloudPlayer } = await import("@admitstory/voice/client");
      player.current ??= createReadAloudPlayer({ createContext: () => audio });
      const outcome = await player.current.speak({
        text: SAMPLE_QUESTION,
        voice: settings.ttsVoice,
        speed: settings.ttsSpeed,
      });
      if (outcome === "error")
        setError("The sample didn't play. Check your connection, then try again.");
    } catch {
      setError("The sample didn't play. Check your connection, then try again.");
    } finally {
      setPlaying(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-voice`} className="flex flex-col gap-6 plane p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-voice`} className="text-lg font-semibold">
          Voice
        </h2>
        <p className="text-text-soft">
          How the Story Studio interviewer sounds, and the language you answer in. Your audio is
          turned into text and not kept.
        </p>
      </div>

      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={settings.readAloud}
          onChange={(event) =>
            void save(
              { readAloud: event.target.checked },
              event.target.checked
                ? "Questions will be read aloud."
                : "Questions won't be read aloud.",
            )
          }
          className="mt-0.5 size-5 accent-signal"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-text">Read questions aloud</span>
          <span className="text-sm text-text-soft">
            When you&apos;re talking in the Studio. The question is always on screen as well.
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium text-text">Interviewer voice</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {TTS_VOICES.map((voice) => (
            <label key={voice.id} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={`${id}-tts-voice`}
                value={voice.id}
                checked={settings.ttsVoice === voice.id}
                onChange={() =>
                  void save({ ttsVoice: voice.id as TtsVoice }, `Voice set to ${voice.label}.`)
                }
                className="size-5 accent-signal"
              />
              {voice.label}
            </label>
          ))}
        </div>
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => void playSample()}
            disabled={!emailVerified}
            aria-describedby={emailVerified ? undefined : `${id}-sample-note`}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            {playing ? "Stop the sample" : "Play a sample"}
          </button>
          {emailVerified ? null : (
            <p id={`${id}-sample-note`} className="text-sm text-text-soft">
              Samples play once your email is verified.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-text">Speaking speed</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {TTS_SPEEDS.map((speed) => (
            <label key={speed} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={`${id}-tts-speed`}
                value={speed}
                checked={settings.ttsSpeed === speed}
                onChange={() =>
                  void save({ ttsSpeed: speed }, `Speed set to ${SPEED_LABELS[speed]}.`)
                }
                className="size-5 accent-signal"
              />
              {SPEED_LABELS[speed]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-language`} className="font-medium text-text">
          Language you speak in
        </label>
        <select
          id={`${id}-language`}
          value={settings.speechLanguage}
          onChange={(event) => {
            const language = SPEECH_LANGUAGES.find((entry) => entry.id === event.target.value);
            if (language)
              void save(
                { speechLanguage: language.id as SpeechLanguage },
                `Language set to ${language.label}.`,
              );
          }}
          aria-describedby={`${id}-language-hint`}
          className="min-h-11 w-full max-w-sm rounded-control border border-control bg-depth px-3 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          {SPEECH_LANGUAGES.map((language) => (
            <option key={language.id} value={language.id}>
              {language.label}
            </option>
          ))}
        </select>
        <p id={`${id}-language-hint`} className="text-sm text-text-soft">
          Choose &ldquo;English and another language&rdquo; if you switch between them. Your Dossier
          is kept in English; lines worth quoting are kept as you said them, with an English version
          beside them.
        </p>
      </div>

      <StatusMessage message={status} />
      <AlertMessage message={error} />
    </section>
  );
}
