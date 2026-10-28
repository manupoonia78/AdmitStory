import { APP_NAME } from "@admitstory/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { hasCompletedWelcome, requireAppUser } from "@/lib/app-user";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Before you start" };

export default async function WelcomePage() {
  const { profile } = await requireAppUser();
  if (hasCompletedWelcome(profile)) redirect("/home");

  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Before you start</h1>
        <p className="text-slate">
          {APP_NAME} helps you tell your own story. Two things first, so you know how it works.
        </p>
      </div>
      <WelcomeForm />
    </AuthFrame>
  );
}
