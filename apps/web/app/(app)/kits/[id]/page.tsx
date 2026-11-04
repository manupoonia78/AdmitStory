import { getDb, getKitContext } from "@admitstory/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";

export const metadata: Metadata = { title: "Your kit" };

/**
 * A kit now lives inside its school (school workspace redesign): /schools/:userSchoolId shows it
 * being prepared and opens its tabs once it's ready. Old links land there.
 */
export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await getKitContext(getDb(), session.user.id, id.data);
  if (!ctx || ctx.kit.status === "preview") notFound();
  redirect(`/schools/${ctx.userSchoolId}`);
}
