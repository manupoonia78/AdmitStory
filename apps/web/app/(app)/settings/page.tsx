import { THEME_COOKIE, ThemeToggle, parseThemePreference } from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Page } from "@/components/page-header";
import { requireOnboardedUser } from "@/lib/app-user";
import { voiceSettingsOf } from "@/lib/voice/server";
import { SettingsLinkRow, SettingsSection } from "./settings-parts";
import { VoiceSettingsForm } from "./voice-settings";
import "./settings.css";

export const metadata: Metadata = { title: "Settings" };

// Settings (SPEC §6.17): one column of sections on hairlines. The dossier comes first as a link
// row; Appearance pairs the theme switch with a small sheet of paper that turns with it.

export default async function SettingsPage() {
  const { session, profile } = await requireOnboardedUser();
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <Page
      eyebrow="Make it yours"
      title="Settings"
      lede="Your dossier, how AdmitStories looks and sounds, and your account."
      width="narrow"
    >
      <div className="flex flex-col">
        <div className="border-t border-edge py-3">
          <SettingsLinkRow
            href="/dossier"
            size="lg"
            title="Your dossier"
            line="Your stories, facts, brand and voice: the only thing your drafts are built from."
          />
        </div>

        <SettingsSection
          id="appearance"
          title="Appearance"
          lede="Match system follows your device's light or dark setting. The casing stays dark either way; only the page you work on changes."
        >
          <div className="flex flex-wrap items-center gap-6">
            <ThemeToggle serverValue={theme} />
            {/* The page you'd write on, in the chosen theme: its colours come from the theme's
                tokens, so it turns with the switch (a 250 ms colour transition, settings.css). */}
            <span aria-hidden className="theme-swatch">
              <span />
              <span />
              <span />
            </span>
          </div>
        </SettingsSection>

        <VoiceSettingsForm
          initial={voiceSettingsOf(profile)}
          emailVerified={session.user.emailVerified === true}
        />

        <SettingsSection id="account" title="Account">
          <p className="text-sm text-text-soft">
            Signed in as{" "}
            <span className="font-mono text-[13px] break-all text-text">{session.user.email}</span>
          </p>
          <div className="flex flex-col">
            <SettingsLinkRow
              href="/settings/security"
              title="Passkeys"
              line="Sign in with your fingerprint, face or device PIN."
            />
            <SettingsLinkRow
              href="/settings/privacy"
              title="Privacy and data"
              line="What we keep, download it, or delete your account."
            />
          </div>
        </SettingsSection>
      </div>
    </Page>
  );
}
