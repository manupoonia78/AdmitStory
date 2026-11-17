import type { Metadata } from "next";
import { TextLink } from "@admitstory/ui";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <AuthShell gap footnote={null}>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-display-2 text-text">We can’t find that page</h1>
        <p className="text-text-soft">The link may be old, or the page may have moved.</p>
      </div>
      <p className="mt-8">
        <TextLink href="/home">Go to Home</TextLink>
      </p>
    </AuthShell>
  );
}
