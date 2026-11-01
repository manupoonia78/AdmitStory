// Dates on the deadline horizon and the round planner (spec §5.5: deadlines in the user's time
// zone). Pure: the page passes `now` and the applicant's time zone, so server and browser render
// the same text and nothing reads the clock during render.

export type Instant = Date | string | number;

const DAY_MS = 86_400_000;

export function toMs(value: Instant): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, format);
  }
  return format;
}

/**
 * Intl formatting with one house rule: English short months are three letters ("12 Sep 2026",
 * spec §5.5), where British English data says "Sept".
 */
export function formatDate(
  at: Instant,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(toMs(at));
  const parts = formatter(locale, options).formatToParts(date);
  if (options.month !== "short" || !locale.toLowerCase().startsWith("en")) {
    return parts.map((part) => part.value).join("");
  }
  const month = formatter("en-US", { month: "short", timeZone: options.timeZone }).format(date);
  return parts.map((part) => (part.type === "month" ? month : part.value)).join("");
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date of an instant in a time zone, as days since 1970-01-01. */
export function calendarDay(at: Instant, timeZone: string): number {
  let format = dayFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    dayFormatters.set(timeZone, format);
  }
  const parts = format.formatToParts(new Date(toMs(at)));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/** Whole calendar days from `now` to `deadline`, both read in the applicant's time zone. */
export function daysUntil(deadline: Instant, now: Instant, timeZone: string): number {
  return calendarDay(deadline, timeZone) - calendarDay(now, timeZone);
}

/** "12 days left", "1 day left", "Due today", "Passed". */
export function daysLeftText(days: number): string {
  if (days < 0) return "Passed";
  if (days === 0) return "Due today";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

/** "6 Jan 2027" in the applicant's time zone. */
export function formatDay(
  at: Instant,
  timeZone: string,
  locale = "en-GB",
  withYear = true,
): string {
  return formatDate(at, locale, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone,
  });
}

/** "6 Jan 2027, 23:59 GMT+5:30": the deadline's moment in the applicant's own time zone. */
export function formatDeadline(at: Instant, timeZone: string, locale = "en-GB"): string {
  return formatDate(at, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });
}

export interface TimeDomain {
  start: number;
  end: number;
}

/**
 * The span the horizon shows: from a little before today (or the earliest date, if earlier) to a
 * little after the last date. With no dates it shows the next three months.
 */
export function timeDomain(dates: readonly Instant[], now: Instant, padDays = 10): TimeDomain {
  const nowMs = toMs(now);
  const all = dates.map(toMs).filter(Number.isFinite);
  if (all.length === 0) return { start: nowMs - padDays * DAY_MS, end: nowMs + 90 * DAY_MS };
  return {
    start: Math.min(nowMs, ...all) - padDays * DAY_MS,
    end: Math.max(nowMs, ...all) + padDays * DAY_MS,
  };
}

/** Where an instant falls on the domain, 0 to 1. */
export function positionIn(domain: TimeDomain, at: Instant): number {
  const span = domain.end - domain.start;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (toMs(at) - domain.start) / span));
}

export interface MonthTick {
  at: number;
  /** "Oct", or "Jan 2027" at the turn of a year and on the first tick. */
  label: string;
}

/** A tick at the start of every month inside the domain. */
export function monthTicks(domain: TimeDomain, locale = "en-GB"): MonthTick[] {
  const first = new Date(domain.start);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth() + 1;
  const ticks: MonthTick[] = [];
  for (let guard = 0; guard < 60; guard += 1) {
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const at = Date.UTC(year, month, 1);
    if (at > domain.end) break;
    const withYear = ticks.length === 0 || month === 0;
    ticks.push({
      at: positionIn(domain, at),
      label: formatDate(at, locale, {
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      }),
    });
    month += 1;
  }
  return ticks;
}

export { DAY_MS };
