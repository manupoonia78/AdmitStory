import type { ComponentProps } from "react";
import { AuthShell } from "./auth-shell";

/** Frame for signed-out pages (sign-in, welcome, goodbye): the entry room. See AuthShell. */
export function AuthFrame(props: ComponentProps<typeof AuthShell>) {
  return <AuthShell {...props} />;
}
