import type { Metadata } from "next";
import { headers } from "next/headers";
import { Page } from "@/components/page-header";
import { getAuth } from "@/lib/auth";
import { requireOnboardedUser } from "@/lib/app-user";
import { PasskeyManager, type PasskeyRow } from "./passkey-manager";

export const metadata: Metadata = { title: "Passkeys" };

// Formatted on the server in UTC, so the client renders exactly the same text.
const ADDED_ON = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function SecurityPage() {
  await requireOnboardedUser();
  const passkeys = await getAuth().api.listPasskeys({ headers: await headers() });
  const rows: PasskeyRow[] = passkeys
    .map((p) => ({
      id: p.id,
      name: p.name?.trim() || "Unnamed passkey",
      createdAt: new Date(p.createdAt),
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(({ createdAt, ...row }) => ({ ...row, addedOn: ADDED_ON.format(createdAt) }));

  return (
    <Page title="Passkeys">
      <p className="max-w-prose text-slate">
        A passkey lets you sign in with your fingerprint, face or device PIN instead of an email
        link. It stays on your device or in your password manager.
      </p>
      <PasskeyManager passkeys={rows} />
    </Page>
  );
}
