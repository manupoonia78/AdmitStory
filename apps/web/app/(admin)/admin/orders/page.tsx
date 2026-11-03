import { adminFindOrders } from "@admitstory/db";
import { REFUND_REASONS } from "@admitstory/payments";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/guard";
import { ActionButton } from "../_components/action-button";
import { table } from "../_components/fields";

export const metadata: Metadata = { title: "Orders" };

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

/** Orders (spec §5.18, §13): find a buyer's purchases by email and refund with a reason code. */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; reason?: string }>;
}) {
  const admin = await requireAdminPage();
  const { email = "", reason = "requested_by_customer" } = await searchParams;
  const orders = email.includes("@") ? await adminFindOrders(admin, email).catch(() => []) : [];
  return (
    <>
      <h1 className="text-display-sm text-text">Orders</h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Buyer&apos;s email
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            className="rounded-md border border-edge bg-surface px-3 py-2 text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Refund reason
          <select
            name="reason"
            defaultValue={reason}
            className="rounded-md border border-edge bg-surface px-3 py-2 text-text"
          >
            {REFUND_REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-edge px-3 py-2 text-text">
          Find orders
        </button>
      </form>
      {email && orders.length === 0 ? (
        <p className="text-text-soft">No purchases for {email}.</p>
      ) : null}
      {orders.length > 0 ? (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Purchases for {email}</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Purchased
                </th>
                <th scope="col" className={table.th}>
                  Product
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Amount
                </th>
                <th scope="col" className={table.th}>
                  Status
                </th>
                <th scope="col" className={table.th}>
                  Entitlement
                </th>
                <th scope="col" className={table.th}>
                  <span className="sr-only">Refund</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map(({ purchase, entitlement }) => (
                <tr key={purchase.id}>
                  <td className={table.td}>{purchase.createdAt.toISOString().slice(0, 10)}</td>
                  <td className={table.td}>{purchase.productKey}</td>
                  <td className={`${table.td} ${table.num}`}>
                    {money(purchase.amountCents, purchase.currency)}
                  </td>
                  <td className={table.td}>{purchase.status.replace(/_/g, " ")}</td>
                  <td className={table.td}>
                    {entitlement
                      ? entitlement.revokedAt
                        ? `Revoked (${entitlement.revokeReason ?? ""})`
                        : `Active · ${JSON.stringify(entitlement.used)}`
                      : "None"}
                  </td>
                  <td className={table.td}>
                    {purchase.status === "completed" ? (
                      <ActionButton
                        action="/api/admin/orders/refund"
                        json={{ purchaseId: purchase.id, reason }}
                        label="Refund"
                        done="Refund requested. Access ends when the provider confirms it."
                        variant="danger"
                        confirm={{
                          title: "Refund this purchase?",
                          body: `Reason: ${reason.replace(/_/g, " ")}. The buyer keeps their dossier; access to the kit ends.`,
                        }}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
