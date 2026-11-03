import type { Metadata } from "next";
import { PLACEHOLDERS } from "@/components/placeholder-copy";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireOnboardedUser } from "@/lib/app-user";

export const metadata: Metadata = { title: PLACEHOLDERS.connect.title };

export default async function Page() {
  await requireOnboardedUser();
  return <PlaceholderPage {...PLACEHOLDERS.connect} />;
}
