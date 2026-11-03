import { THEME_COOKIE, TextLink, ThemeToggle, parseThemePreference } from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Page } from "@/components/page-header";
import { requireOnboardedUser } from "@/lib/app-user";
import { voiceSettingsOf } from "@/lib/voice/server";
import { VoiceSettingsForm } from "./voice-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { session, profile } = await requireOnboardedUser();
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <Page title="Settings">
      <section aria-labelledby="appearance" className="flex flex-col gap-3 plane p-6">
        <h2 id="appearance" className="text-lg font-semibold">
          Appearance
        </h2>
        <p className="text-text-soft">
          Match system follows your device&apos;s light or dark setting. Story Studio and live mocks
          open in Night unless you choose Day.
        </p>
        <ThemeToggle serverValue={theme} className="self-start" />
      </section>

      <VoiceSettingsForm
        initial={voiceSettingsOf(profile)}
        emailVerified={session.user.emailVerified === true}
      />

      <section aria-labelledby="account" className="flex flex-col gap-3 plane p-6">
        <h2 id="account" className="text-lg font-semibold">
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
