// Where your voice goes (SPEC §4.2, /privacy): the page's one moment. One line doing the
// Voiceline's three jobs: a waveform from the microphone to speech-to-text (a voice), a flat rule
// on through text, the Dossier and the drafts (words), and a branch from speech-to-text that dies
// away into a full stop: the audio, discarded. As the figure comes into view the voice draws, the
// rule runs on, the branch draws and the full stop lands (marketing.css, .vp; 1.6 s in all).
// Server markup and CSS only: drawn and complete without JavaScript and under reduced motion.
// The drawings are decorative; the description says it in words.

import { PRIVACY_COPY } from "../_copy/privacy";

/** A spoken line between x0 and x1 around y: swelling, then settling (the hero's shape, frozen). */
function wave(x0: number, x1: number, y: number, amp: number, decay = false): string {
  const steps = 64;
  let d = `M${x0} ${y}`;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const envelope = decay ? (1 - t) ** 1.6 : Math.sin(Math.PI * t) ** 1.2;
    const dy = amp * envelope * (Math.sin(t * 19) * 0.7 + Math.sin(t * 43 + 1.3) * 0.3);
    d += `L${(x0 + (x1 - x0) * t).toFixed(1)} ${(y + dy).toFixed(1)}`;
  }
  return d;
}

const W = 1000;
const LINE_Y = 24;
const BRANCH_Y = 104;
/** Stops at the left edge of five equal columns. */
const STOP_X = [0, 200, 400, 600, 800] as const;
const DOT_X = 420;

const VOICE = wave(0, 200, LINE_Y, 14);
const TEXT = `M200 ${LINE_Y}H800`;
const BRANCH = `M200 ${LINE_Y}C 236 ${LINE_Y}, 230 ${BRANCH_Y}, 270 ${BRANCH_Y}${wave(270, DOT_X - 10, BRANCH_Y, 12, true).replace(/^M[^L]+/, "")}`;

export function VoicePathDiagram() {
  const { stops, audio } = PRIVACY_COPY;
  return (
    <figure
      aria-labelledby="voice-path-title"
      className="vp reveal col-span-4 sm:col-span-8 lg:col-span-12"
    >
      <div className="vp-head">
        <h2 id="voice-path-title" className="font-display text-display-3 text-text">
          {PRIVACY_COPY.diagramTitle}
        </h2>
        <p className="vp-desc">{PRIVACY_COPY.diagramDescription}</p>
      </div>

      {/* Laptops: across. */}
      <div aria-hidden="true" className="vp-across">
        <ol role="list" className="vp-stops">
          {stops.map((stop) => (
            <li key={stop.name}>
              <span className="vp-name">{stop.name}</span>
              <span className="label">{stop.label}</span>
            </li>
          ))}
        </ol>
        <div className="vp-drawing">
          <svg viewBox={`0 0 ${W} 132`} preserveAspectRatio="none" fill="none" focusable="false">
            <path d={VOICE} className="vp-voice" />
            <path d={TEXT} className="vp-text" />
            <path d={BRANCH} className="vp-branch" />
          </svg>
          {STOP_X.map((x) => (
            <span key={x} className="vp-ring" style={{ left: `${x / 10}%`, top: LINE_Y }} />
          ))}
          <span className="vp-dot" style={{ left: `${DOT_X / 10}%`, top: BRANCH_Y }} />
          <span className="vp-audio" style={{ left: `calc(${DOT_X / 10}% + 20px)`, top: BRANCH_Y }}>
            <span className="vp-name">{audio.name}</span>
            <span className="label">{audio.label}</span>
          </span>
        </div>
      </div>

      {/* Phones and tablets: down the left edge. */}
      <ol role="list" aria-hidden="true" className="vp-down">
        {stops.map((stop, index) => (
          <li key={stop.name} data-voice={index === 0 ? "" : undefined}>
            <span className="vp-ring" />
            <span className="vp-name">{stop.name}</span>
            <span className="label">{stop.label}</span>
            {index === 1 ? (
              <span className="vp-down-audio">
                <svg viewBox="0 0 96 24" fill="none" focusable="false">
                  <path d={wave(0, 86, 12, 8, true)} className="vp-branch" />
                </svg>
                <span className="vp-dot" />
                <span>
                  <span className="vp-name">{audio.name}</span>
                  <span className="label">{audio.label}</span>
                </span>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
