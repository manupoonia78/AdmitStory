import { THEME_COOKIE, TextLink, ThemeToggle, parseThemePreference } from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Page } from "@/components/page-header";
import { requireOnboardedUser } from "@/lib/app-user";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { session } = await requireOnboardedUser();
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <Page title="Settings">
      <section
        aria-labelledby="appearance"
        className="flex flex-col gap-3 rounded-panel border border-line bg-paper p-6"
      >
        <h2 id="appearance" className="text-lg font-bold">
          Appearance
        </h2>
        <p className="text-slate">Match system follows your device&apos;s light or dark setting.</p>
        <ThemeToggle serverValue={theme} className="self-start" />
      </section>

      <section
        aria-labelledby="account"
        className="flex flex-col gap-3 rounded-panel border border-line bg-paper p-6"
      >
        <h2 id="account" className="text-lg font-bold">
          Account
        </h2>
        <p>
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
        <p>
          <TextLink href="/settings/security">Manage passkeys</TextLink>
        </p>
      </section>
    </Page>
  );
}
