// Where your voice goes (direction §7): Microphone → Speech-to-text (Deepgram) → Text → Your
// Dossier (encrypted) → Your drafts, with a branch from speech-to-text to "Audio", which ends in a
// closed mark: "Discarded". Drawn in --edge with UI 13 labels. When it is 40% in view one dot of
// --voice light runs the audio branch and fades at "Discarded" while a second runs on to "Your
// drafts" (SVG animateMotion, so the dots follow the drawn paths at any size; ./voice-path-play
// starts them). Reduced motion: still. Two drawings, across from 1024 px and down on narrower
// screens, so the labels stay 13 px. The SVGs are decorative; a paragraph says it in words.

import { PRIVACY_COPY } from "../_copy/privacy";
import { VoicePathPlay } from "./voice-path-play";

type Anchor = "start" | "middle" | "end";

interface Label {
  x: number;
  y: number;
  text: string;
  anchor?: Anchor;
  strong?: boolean;
}

interface Drawing {
  key: "h" | "v";
  width: number;
  height: number;
  /** The main line, the audio branch, and the closed mark at its end. */
  main: string;
  branch: string;
  mark: { x: number; y: number };
  nodes: readonly { x: number; y: number }[];
  labels: readonly Label[];
  className: string;
}

const N = PRIVACY_COPY.nodes;

const ACROSS: Drawing = {
  key: "h",
  width: 960,
  height: 260,
  main: "M40 90 L900 90",
  branch: "M40 90 L250 90 C 290 90, 290 200, 330 200 L440 200",
  mark: { x: 440, y: 200 },
  nodes: [
    { x: 40, y: 90 },
    { x: 250, y: 90 },
    { x: 470, y: 90 },
    { x: 680, y: 90 },
    { x: 900, y: 90 },
  ],
  labels: [
    { x: 30, y: 62, text: N.microphone, anchor: "start" },
    { x: 250, y: 62, text: N.stt },
    { x: 470, y: 62, text: N.text, strong: true },
    { x: 680, y: 62, text: N.dossier },
    { x: 910, y: 62, text: N.drafts, anchor: "end" },
    { x: 360, y: 188, text: N.audio, anchor: "start" },
    { x: 440, y: 232, text: N.discarded },
  ],
  className: "hidden w-full max-w-[960px] lg:block",
};

const DOWN: Drawing = {
  key: "v",
  width: 340,
  height: 520,
  main: "M24 24 L24 480",
  branch: "M24 24 L24 130 C 24 175, 60 190, 110 190 L250 190",
  mark: { x: 250, y: 190 },
  nodes: [
    { x: 24, y: 24 },
    { x: 24, y: 130 },
    { x: 24, y: 280 },
    { x: 24, y: 380 },
    { x: 24, y: 480 },
  ],
  labels: [
    { x: 44, y: 28, text: N.microphone, anchor: "start" },
    { x: 44, y: 134, text: N.stt, anchor: "start" },
    { x: 44, y: 284, text: N.text, anchor: "start", strong: true },
    { x: 44, y: 384, text: N.dossier, anchor: "start" },
    { x: 44, y: 484, text: N.drafts, anchor: "start" },
    { x: 130, y: 178, text: N.audio, anchor: "start" },
    { x: 250, y: 220, text: N.discarded },
  ],
  className: "block w-full max-w-[340px] lg:hidden",
};

/** One run: the audio dot takes 2.2 s and fades at the mark; the text dot takes 3.4 s and stays. */
function Dots({ drawing }: { drawing: Drawing }) {
  const start = `voice-start-${drawing.key}`;
  const glow = { filter: "drop-shadow(0 0 6px var(--voice-glow))" };
  return (
    <>
      <animate
        id={start}
        data-voice-start=""
        attributeName="opacity"
        from="0"
        to="0"
        dur="0.01s"
        begin="indefinite"
      />
      <circle r="5" fill="var(--voice)" opacity="0" style={glow}>
        <animateMotion
          path={drawing.branch}
          dur="2.2s"
          begin={`${start}.begin`}
          fill="freeze"
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.3 0 0.2 1"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.06;0.8;1"
          dur="2.6s"
          begin={`${start}.begin`}
          fill="freeze"
        />
      </circle>
      <circle r="5" fill="var(--voice)" opacity="0" style={glow}>
        <animateMotion
          path={drawing.main}
          dur="3.4s"
          begin={`${start}.begin`}
          fill="freeze"
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.3 0 0.2 1"
        />
        <animate
          attributeName="opacity"
          values="0;1;1"
          keyTimes="0;0.05;1"
          dur="3.4s"
          begin={`${start}.begin`}
          fill="freeze"
        />
      </circle>
    </>
  );
}

function PathDrawing({ drawing }: { drawing: Drawing }) {
  const { mark } = drawing;
  return (
    <svg
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      aria-hidden="true"
      focusable="false"
      className={drawing.className}
    >
      <g fill="none" stroke="var(--edge)" strokeWidth="1.5" strokeLinecap="round">
        <path d={drawing.main} />
        <path d={drawing.branch} />
      </g>
      {drawing.nodes.map((node) => (
        <circle
          key={`${node.x}-${node.y}`}
          cx={node.x}
          cy={node.y}
          r="6"
          fill="var(--space)"
          stroke="var(--edge)"
          strokeWidth="1.5"
        />
      ))}
      {/* The closed mark: a stop, where the audio ends. */}
      <g stroke="var(--text-soft)" strokeWidth="1.5" strokeLinecap="round">
        <circle cx={mark.x} cy={mark.y} r="8" fill="var(--space)" />
        <path d={`M${mark.x - 4} ${mark.y} L${mark.x + 4} ${mark.y}`} />
      </g>
      <g fontSize="13" fontFamily="var(--font-ui)">
        {drawing.labels.map((label) => (
          <text
            key={label.text}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor ?? "middle"}
            fill={label.strong ? "var(--text)" : "var(--text-soft)"}
            fontWeight={label.strong ? 600 : 400}
          >
            {label.text}
          </text>
        ))}
      </g>
      <Dots drawing={drawing} />
    </svg>
  );
}

const DIAGRAM_ID = "voice-path";

export function VoicePathDiagram() {
  return (
    <figure id={DIAGRAM_ID} aria-labelledby="voice-path-title">
      <h2 id="voice-path-title" className="text-read-lg font-semibold text-text">
        {PRIVACY_COPY.diagramTitle}
      </h2>
      <div className="mt-8">
        <PathDrawing drawing={ACROSS} />
        <PathDrawing drawing={DOWN} />
      </div>
      <figcaption className="sr-only">{PRIVACY_COPY.diagramDescription}</figcaption>
      <VoicePathPlay target={DIAGRAM_ID} />
    </figure>
  );
}
