import { describe, expect, it } from "vitest";
import type { AnalysisFrame } from "./audio-features";
import {
  IDENTITY_MIN_SECONDS,
  IDENTITY_SAMPLE_SECONDS,
  SYLLABLES_PER_WORD,
  createIdentityAccumulator,
  identityFromText,
  variation,
} from "./identity";
import { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";

interface Speaker {
  seconds: number;
  syllablesPerSecond?: number;
  pitchHz?: number;
  rangeSemitones?: number;
  /** Seconds of speech between pauses. */
  phrase?: number;
  /** Pause lengths, cycled. */
  pauses?: number[];
}

const FPS = 60;

/** Synthetic analysis frames: phrases of syllables (loudness peaks) with pauses between. */
function speaker({
  seconds,
  syllablesPerSecond = 4,
  pitchHz = 140,
  rangeSemitones = 8,
  phrase = 3,
  pauses = [0.5],
}: Speaker): AnalysisFrame[] {
  const frames: AnalysisFrame[] = [];
  let spoken = 0;
  let inPhrase = 0;
  let pauseLeft = 0;
  let pauseIndex = 0;
  for (let i = 0; i < seconds * FPS; i += 1) {
    const time = i / FPS;
    const dt = i === 0 ? 0 : 1 / FPS;
    if (pauseLeft > 0) {
      pauseLeft -= dt;
      frames.push({ time, dt, snrDb: 0, amplitude: 0, centroid: 0, pitchHz: null, pitchDelta: 0 });
      continue;
    }
    spoken += dt;
    inPhrase += dt;
    const syllable = 0.5 + 0.5 * Math.cos(2 * Math.PI * syllablesPerSecond * spoken);
    const snrDb = 14 + 16 * syllable;
    const pitch =
      pitchHz * 2 ** ((rangeSemitones / 2 / 12) * Math.sin(2 * Math.PI * 0.37 * spoken));
    frames.push({
      time,
      dt,
      snrDb,
      amplitude: Math.min(1, (snrDb - 8) / 34),
      centroid: 0.5,
      pitchHz: pitch,
      pitchDelta: 0,
    });
    if (inPhrase >= phrase) {
      inPhrase = 0;
      pauseLeft = pauses[pauseIndex % pauses.length] ?? 0.5;
      pauseIndex += 1;
    }
  }
  return frames;
}

const listen = (frames: AnalysisFrame[]) => {
  const accumulator = createIdentityAccumulator();
  for (const frame of frames) accumulator.add(frame);
  return accumulator;
};

describe("createIdentityAccumulator", () => {
  it("needs a minimum of speech before it gives an identity", () => {
    const short = listen(speaker({ seconds: IDENTITY_MIN_SECONDS * 0.6 }));
    expect(short.snapshot().usable).toBe(false);
    expect(short.identity()).toBeNull();

    const enough = listen(speaker({ seconds: 20 }));
    expect(enough.snapshot().usable).toBe(true);
    expect(enough.identity()?.source).toBe("voice");
  });

  it("counts speech, not pauses, towards the three minutes, and stops there", () => {
    const accumulator = listen(speaker({ seconds: 70, phrase: 3, pauses: [1] }));
    const { speechSeconds, progress } = accumulator.snapshot();
    // 3 s of speech in every 4 s.
    expect(speechSeconds).toBeGreaterThan(50);
    expect(speechSeconds).toBeLessThan(54);
    expect(progress).toBeCloseTo(speechSeconds / IDENTITY_SAMPLE_SECONDS, 5);

    const full = listen(speaker({ seconds: 260, pauses: [0.4] }));
    expect(full.snapshot().done).toBe(true);
    expect(full.snapshot().progress).toBe(1);
    expect(full.snapshot().speechSeconds).toBeLessThan(IDENTITY_SAMPLE_SECONDS + 0.1);
  });

  it("takes the median pitch and the p10 to p90 range in semitones", () => {
    const identity = listen(speaker({ seconds: 60, pitchHz: 120, rangeSemitones: 10 })).identity()!;
    expect(identity.avgPitchHz).toBeGreaterThan(114);
    expect(identity.avgPitchHz).toBeLessThan(126);
    expect(identity.pitchRangeSemitones).toBeGreaterThan(8);
    expect(identity.pitchRangeSemitones).toBeLessThan(11);
  });

  it("estimates pace from syllable nuclei over talking time", () => {
    // 4 syllables a second for 3 s, then a 0.5 s pause: 12 syllables every 3.5 s.
    const expected = (((4 * 3) / 3.5) * 60) / SYLLABLES_PER_WORD;
    const steady = listen(speaker({ seconds: 90, syllablesPerSecond: 4 })).identity()!;
    expect(Math.abs(steady.paceWpm - expected) / expected).toBeLessThan(0.15);

    const quick = listen(speaker({ seconds: 90, syllablesPerSecond: 5.5 })).identity()!;
    expect(quick.paceWpm).toBeGreaterThan(steady.paceWpm + 30);
  });

  it("scores irregular pauses higher than even ones", () => {
    const even = listen(speaker({ seconds: 90, pauses: [0.6] })).identity()!;
    const uneven = listen(
      speaker({ seconds: 90, phrase: 2.2, pauses: [0.3, 2.5, 0.5, 1.6, 0.35, 3.2] }),
    ).identity()!;
    expect(even.pauseRhythm).toBeLessThan(0.15);
    expect(uneven.pauseRhythm).toBeGreaterThan(0.5);
    expect(uneven.pauseRhythm).toBeLessThanOrEqual(1);
  });

  it("keeps only the four rounded numbers", () => {
    const identity = listen(speaker({ seconds: 40 })).identity()!;
    expect(Object.keys(identity).sort()).toEqual(
      ["avgPitchHz", "paceWpm", "pauseRhythm", "pitchRangeSemitones", "source", "version"].sort(),
    );
    expect(Number.isInteger(identity.paceWpm)).toBe(true);
    expect(identity.avgPitchHz).toBe(Number(identity.avgPitchHz.toFixed(1)));
    expect(identity.pauseRhythm).toBe(Number(identity.pauseRhythm.toFixed(2)));
  });

  it("starts over on reset", () => {
    const accumulator = listen(speaker({ seconds: 30 }));
    accumulator.reset();
    expect(accumulator.snapshot()).toEqual({
      speechSeconds: 0,
      progress: 0,
      done: false,
      usable: false,
    });
  });
});

describe("identityFromText", () => {
  // Synthetic answers for a fictional applicant.
  const flowing = [
    "When the plant in our second city lost its scheduling lead two weeks before peak season, I moved there for a month, rebuilt the shift plan with the floor supervisors, and we shipped every order on time.",
    "I learned that the people closest to the work usually know the answer already, and that my job is to make it safe for them to say it out loud, even when it means changing a plan I wrote myself.",
  ];
  const punchy = [
    "I grew up above a bakery. We opened at five. I ran the till at nine years old.",
    "It taught me speed. It taught me patience too. Customers remember small things.",
  ];

  it("defaults when there is nothing to read", () => {
    expect(identityFromText([])).toEqual(DEFAULT_IDENTITY);
    expect(identityFromText(["   ", "\n"])).toEqual(DEFAULT_IDENTITY);
  });

  it("is deterministic and marked as seeded from writing", () => {
    expect(identityFromText(flowing)).toEqual(identityFromText([...flowing]));
    expect(identityFromText(flowing).source).toBe("text");
  });

  it("reads long sentences as a faster pace and short ones as a higher pitch", () => {
    const long = identityFromText(flowing);
    const short = identityFromText(punchy);
    expect(long.paceWpm).toBeGreaterThan(short.paceWpm);
    expect(short.avgPitchHz).toBeGreaterThan(long.avgPitchHz);
  });

  it("stays inside speaking ranges", () => {
    for (const answers of [flowing, punchy, ["One."], ["word ".repeat(400)]]) {
      const identity = identityFromText(answers);
      expect(identity.avgPitchHz).toBeGreaterThanOrEqual(95);
      expect(identity.avgPitchHz).toBeLessThanOrEqual(251);
      expect(identity.paceWpm).toBeGreaterThanOrEqual(100);
      expect(identity.paceWpm).toBeLessThanOrEqual(200);
      expect(identity.pauseRhythm).toBeGreaterThanOrEqual(0);
      expect(identity.pauseRhythm).toBeLessThanOrEqual(1);
    }
  });

  it("gives different writers visibly different Voiceprints", () => {
    const a = paramsFromIdentity(identityFromText(flowing));
    const b = paramsFromIdentity(identityFromText(punchy));
    expect(a.seed).not.toBe(b.seed);
    expect(a.hueIndex !== b.hueIndex || Math.abs(a.filamentCount - b.filamentCount) >= 2).toBe(
      true,
    );
  });
});

describe("variation", () => {
  it("is 0 for a constant list and grows with spread", () => {
    expect(variation([2, 2, 2])).toBe(0);
    expect(variation([1])).toBe(0);
    expect(variation([1, 3])).toBeCloseTo(0.5, 5);
  });
});
