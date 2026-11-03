import "server-only";

// Shared by the Costs page and its CSV export: the range tabs are 7, 30 or 90 days ending now.

export const COST_RANGES = [7, 30, 90] as const;

export function costRange(
  days: string | null | undefined,
  replay: string | null | undefined,
): { from: Date; to: Date; includeReplay: boolean; days: number } {
  const n = Number(days);
  const span = (COST_RANGES as readonly number[]).includes(n) ? n : 30;
  const to = new Date();
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - (span - 1) * 86_400_000,
  );
  return { from, to, includeReplay: replay === "1", days: span };
}

export const usd = (value: number): string =>
  value >= 100
    ? `$${value.toFixed(0)}`
    : value >= 1
      ? `$${value.toFixed(2)}`
      : `$${value.toFixed(4)}`;

export const percent = (value: number): string => `${Math.round(value * 100)}%`;

/** "2 Nov, 14:05 UTC" (direction doc, M). */
export function stamp(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(date)
    .replace("Sept", "Sep");
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${day}, ${time} UTC`;
}
