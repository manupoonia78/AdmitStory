import { SkipLink } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin/guard";

// The admin console (spec §5.18, screen M). No hero (§6.7): dim chrome, hairline rules, dense
// tables. Every page and every /api/admin route checks the admin role on its own request; this
// layout's check only keeps the chrome from rendering for anyone else.

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin/schools", label: "Schools and cycles" },
  { href: "/admin/sources", label: "Knowledge sources" },
  { href: "/admin/ai-policies", label: "AI policies" },
  { href: "/admin/canon", label: "Canon" },
  { href: "/admin/prompts", label: "Prompts" },
  { href: "/admin/orders", label: "Orders" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return (
    <div className="min-h-dvh bg-space text-text">
      <SkipLink targetId="admin-main" />
      <header className="border-b border-edge">
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-sm"
        >
          <Link href="/admin/schools" className="font-semibold text-text">
            Admin
          </Link>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-text-soft underline-offset-4 hover:text-text hover:underline"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/home" className="ml-auto text-text-soft hover:text-text">
            Back to the app
          </Link>
        </nav>
      </header>
      <main
        id="admin-main"
        tabIndex={-1}
        className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 py-6"
      >
        {children}
      </main>
    </div>
  );
}
