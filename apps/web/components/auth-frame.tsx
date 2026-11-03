import type { ReactNode } from "react";
import { AuthShell } from "./auth-shell";

/** Frame for signed-out pages (sign-in, welcome, goodbye). See AuthShell. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
