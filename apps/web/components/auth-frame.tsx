import { SceneHost } from "@admitstory/ui";
import type { ReactNode } from "react";
import { AuthShell } from "./auth-shell";

/**
 * Frame for signed-out pages (sign-in, welcome, goodbye): the brand, one focused glass panel, and
 * the studio's portal object lit behind it on the right (scene/studio-scene.ts).
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <AuthShell backdrop={<SceneHost pathname="" scene="portal" />}>{children}</AuthShell>;
}
