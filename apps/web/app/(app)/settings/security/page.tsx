import { FingerprintIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Page } from "@/components/page-header";
import { getAuth } from "@/lib/auth";
import { requireOnboardedUser } from "@/lib/app-user";
import { PasskeyManager, type PasskeyIcons, type PasskeyRow } from "./passkey-manager";

export const metadata: Metadata = { title: "Passkeys" };

// Formatted on the server in UTC, so the client renders exactly the same text.
const ADDED_ON = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Rendered here, on the server, and handed to the client manager as elements: the four icons
// were about 7 KB gz of the route's first-load JS (spec §6.11: 160 KB per route).
const ICONS: PasskeyIcons = {
  add: <PlusIcon size={20} />,
  rename: <PencilSimpleIcon size={16} />,
  remove: <TrashIcon size={16} />,
  passkey: <FingerprintIcon size={20} />,
};

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
      <p className="max-w-prose text-text-soft">
        A passkey lets you sign in with your fingerprint, face or device PIN instead of an email
        link. It stays on your device or in your password manager.
      </p>
      <PasskeyManager passkeys={rows} icons={ICONS} />
    </Page>
  );
}
