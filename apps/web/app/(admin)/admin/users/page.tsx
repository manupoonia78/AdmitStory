import { findUsers } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, table } from "../_components/fields";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Users" };

/** Users (spec §5.18): find an account by email (prefix) or id. */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdminPage();
  const { q = "" } = await searchParams;
  const hits = q.trim() ? await findUsers(admin, q, 50) : [];
  return (
    <>
      <h1 className="text-display-sm text-text">Users</h1>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Email or user id
          <input
            name="q"
            defaultValue={q}
            required
            autoComplete="off"
            className="min-w-72 rounded-md border border-edge bg-surface px-3 py-2 text-text"
          />
        </label>
        <button type="submit" className="rounded-md border border-edge px-3 py-2 text-text">
          Find
        </button>
      </form>
      {q && hits.length === 0 ? <p className="text-text-soft">No account matches “{q}”.</p> : null}
      {hits.length > 0 ? (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Accounts matching {q}</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Email
                </th>
                <th scope="col" className={table.th}>
                  Joined
                </th>
                <th scope="col" className={table.th}>
                  Roles
                </th>
                <th scope="col" className={table.th}>
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {hits.map((u) => (
                <tr key={u.id}>
                  <td className={table.td}>
                    <Link href={`/admin/users/${u.id}`} className="underline underline-offset-4">
                      {u.email}
                    </Link>
                  </td>
                  <td className={table.td}>{formatDate(u.createdAt)}</td>
                  <td className={table.td}>{u.roles.join(", ") || "Applicant"}</td>
                  <td className={table.td}>{u.paid ? "Paid" : "Free"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
