import type { Metadata } from "next";
import { TextLink } from "@admitstory/ui";
import { AuthFrame } from "@/components/auth-frame";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-graphite">We can&apos;t find that page</h1>
        <p className="text-slate">The link may be old, or the page may have moved.</p>
      </div>
      <p>
        <TextLink href="/home">Go to Home</TextLink>
      </p>
    </AuthFrame>
  );
}
