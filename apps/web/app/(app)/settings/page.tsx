import { THEME_COOKIE, TextLink, ThemeToggle, parseThemePreference } from "@admitstory/ui";
import { ArrowRightIcon, CardsThreeIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
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
    <Page
      eyebrow="Make it yours"
      title="Settings"
      lede="Your dossier, how AdmitStory looks and sounds, and your account."
    >
      <Link
        href="/dossier"
        className="group plane flex items-center gap-5 p-6 transition-colors hover:border-control sm:p-7"
      >
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-control border border-edge bg-space text-accent"
        >
          <CardsThreeIcon size={22} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[1.5rem] leading-tight text-text">Your dossier</span>
          <span className="text-text-soft">
            Your stories, facts, brand and voice: the only thing your drafts are built from.
          </span>
        </span>
        <ArrowRightIcon
          size={20}
          aria-hidden
          className="shrink-0 text-text-soft transition-transform group-hover:translate-x-1 group-hover:text-text"
        />
      </Link>

      <section aria-labelledby="appearance" className="flex flex-col gap-3 plane p-6 sm:p-7">
        <h2
          id="appearance"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Appearance
        </h2>
        <p className="text-text-soft">
          Match system follows your device&apos;s light or dark setting.
        </p>
        <ThemeToggle serverValue={theme} className="self-start" />
      </section>

      <VoiceSettingsForm
        initial={voiceSettingsOf(profile)}
        emailVerified={session.user.emailVerified === true}
      />

      <section aria-labelledby="account" className="flex flex-col gap-3 plane p-6 sm:p-7">
        <h2
          id="account"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Account
        </h2>
        <p>
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
        <p>
          <TextLink href="/settings/security">Manage passkeys</TextLink>
        </p>
        <p>
          <TextLink href="/settings/privacy">Privacy and data</TextLink>
          <span className="text-text-soft">
            : what we keep, download it, or delete your account
          </span>
        </p>
      </section>
    </Page>
  );
}
