// The sample applicant's hue as a style (spec §6.2: --voice belongs to the applicant). Wrap any
// applicant material in it: the hero poster, the frames, the essay sheets. Server components only,
// so the hue maths never ships to the browser; islands inherit the custom properties.

import { paramsFromIdentity, voiceHueStyle } from "@admitstory/ui";
import type { CSSProperties } from "react";
import { SAMPLE_IDENTITY } from "../_data/sample";

export const SAMPLE_HUE_INDEX = paramsFromIdentity(SAMPLE_IDENTITY).hueIndex;

export function sampleHueStyle(): CSSProperties {
  return voiceHueStyle(SAMPLE_HUE_INDEX);
}
