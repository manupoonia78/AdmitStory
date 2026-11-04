import type { StaffAccessEntry } from "@admitstory/shared";
import { PrivacyInventoryList, TextLink } from "@admitstory/ui";
import type { Metadata } from "next";
import { Page } from "@/components/page-header";
import { loadPrivacyView } from "@/lib/account/view";
import { requireOnboardedUser } from "@/lib/app-user";
import { PrivacyActions } from "./privacy-actions";

export const metadata: Metadata = { title: "Privacy and data" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const ACTION_WORDS: Record<StaffAccessEntry["action"], string> = {
  viewed_content: "read your content",
  opened_access: "opened access to your account",
  changed_access: "changed what your kit allows",
  refund: "refunded a purchase",
  role: "changed your account's role",
};

/**
 * Settings › Privacy and data (spec §11 Account, §14.4). The hero is the plain inventory of what
 * we keep; everything else is quiet: downloads, the "Help improve" switch, staff access, deletion.
 */
export default async function PrivacyPage() {
  const user = await requireOnboardedUser();
  const view = await loadPrivacyView(user);

  return (
    <Page eyebrow="Settings" title="Privacy and data">
      <section aria-labelledby="keep" className="flex flex-col gap-4 plane p-6">
        <h2
          id="keep"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          What we keep
        </h2>
        <PrivacyInventoryList inventory={view.inventory} />
        <p className="text-sm text-text-soft">
          Your stories and drafts are encrypted at rest and never used to train AI models. Read the{" "}
          <TextLink href="/privacy">privacy policy</TextLink>.
        </p>
      </section>

      <PrivacyActions improveOptIn={view.improveOptIn} sessionFresh={view.sessionFresh} />

      <section aria-labelledby="staff" className="flex flex-col gap-3 plane p-6">
        <h2
          id="staff"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Staff access
        </h2>
        {view.staffAccess.length === 0 ? (
          <p className="text-text-soft">No one at AdmitStories has opened your account.</p>
        ) : (
          <>
            <p className="text-text-soft">
              Our team only opens an account for a reason, for 30 minutes at most, and every look is
              listed here.
            </p>
            <ul className="flex flex-col gap-2">
              {view.staffAccess.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="text-text">
                  <span className="tabular-nums">{WHEN.format(new Date(entry.at))} UTC</span>: our
                  team {ACTION_WORDS[entry.action]}.
                  {entry.reason ? (
                    <span className="text-text-soft"> Reason: “{entry.reason}”</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Page>
  );
}
