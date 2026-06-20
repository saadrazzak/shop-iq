const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60]
];

const UNIT_ABBREVIATIONS: Record<Intl.RelativeTimeFormatUnit, string> = {
  year: "y",
  years: "y",
  quarter: "q",
  quarters: "q",
  month: "mo",
  months: "mo",
  week: "w",
  weeks: "w",
  day: "d",
  days: "d",
  hour: "h",
  hours: "h",
  minute: "m",
  minutes: "m",
  second: "s",
  seconds: "s"
};

/** Formats an ISO date as a compact relative time, e.g. "5d", "2w", "11mo". */
export function formatRelativeTime(isoDate: string): string {
  const seconds = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (seconds < 60) return "now";

  for (const [unit, secondsInUnit] of UNITS) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) return `${value}${UNIT_ABBREVIATIONS[unit]}`;
  }

  return "now";
}
