// The still Voiceprint as a standalone SVG string: the same geometry as VoiceprintStill (idle
// mood), with the colour baked in. For places that can't render React or read CSS: the Open Graph
// image (Satori takes it as an <img> data URI), and later emails and exports. Pure, server-safe.

import { filaments, motes } from "./geometry";
import { paramsFromIdentity } from "./params";
import type { VoiceprintIdentity } from "./types";

const round = (value: number) => Math.round(value * 1000) / 1000;

export function voiceprintStillSvg(
  identity: VoiceprintIdentity,
  color: string,
  size = 100,
): string {
  if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) throw new Error("voiceprintStillSvg needs a hex colour");
  const params = paramsFromIdentity(identity);
  const ellipses = filaments(params)
    .map(
      (f) =>
        `<ellipse cx="${round(f.cx)}" cy="${round(f.cy)}" rx="${round(f.rx)}" ry="${round(f.ry)}" stroke-opacity="${round(f.opacity)}" transform="rotate(${round(f.rotate)} ${round(f.cx)} ${round(f.cy)})"/>`,
    )
    .join("");
  const dots = motes(params)
    .map(
      (m) =>
        `<circle cx="${round(m.cx)}" cy="${round(m.cy)}" r="${round(m.r)}" fill-opacity="${round(m.opacity)}"/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<defs><radialGradient id="glow">` +
    `<stop offset="0%" stop-color="${color}" stop-opacity="0.7"/>` +
    `<stop offset="55%" stop-color="${color}" stop-opacity="0.18"/>` +
    `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="50" cy="50" r="48" fill="url(#glow)"/>` +
    `<g fill="none" stroke="${color}" stroke-width="0.6">${ellipses}</g>` +
    `<g fill="${color}">${dots}</g>` +
    `</svg>`
  );
}
