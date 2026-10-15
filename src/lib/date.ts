function isValidDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year > 0 && date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Parse user input explicitly: JavaScript otherwise treats slash dates as US dates.
export function parseDateDDMMYYYY(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match || !isValidDate(Number(match[3]), Number(match[2]), Number(match[1]))) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function getTodayDDMMYYYY(date = new Date()) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).padStart(4, "0")}`;
}

export function formatDateDDMMYYYY(value: string | null | undefined) {
  if (!value) return "TBC";

  if (value.includes("/")) return parseDateDDMMYYYY(value) ? value : "TBC";

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymdMatch) {
    const formatted = `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
    return parseDateDDMMYYYY(formatted) ? formatted : "TBC";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return getTodayDDMMYYYY(date);
}

function toUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isWithinRange(date: Date, startValue: string | null | undefined, endValue: string | null | undefined) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (start && !Number.isNaN(start.getTime()) && date < start) return false;
  if (end && !Number.isNaN(end.getTime()) && date > end) return false;

  return true;
}

export function formatLogEntryDateDDMMYYYY(
  value: string | null | undefined,
  projectStartDate?: string | null,
  projectEndDate?: string | null
) {
  if (!value) return "TBC";

  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!slashMatch) return formatDateDDMMYYYY(value);

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);

  const ddmmDate = toUtcDate(year, second, first);
  const mmddDate = toUtcDate(year, first, second);
  const ddmmValid = isValidDate(year, second, first);
  const mmddValid = isValidDate(year, first, second);
  const ddmmInRange = ddmmValid && isWithinRange(ddmmDate, projectStartDate, projectEndDate);
  const mmddInRange = mmddValid && isWithinRange(mmddDate, projectStartDate, projectEndDate);

  if (mmddValid && (!ddmmValid || (mmddInRange && !ddmmInRange))) {
    return `${slashMatch[2]}/${slashMatch[1]}/${slashMatch[3]}`;
  }

  return ddmmValid ? `${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}` : "TBC";
}

// Only normalize generated log headers, leaving users' free-text notes intact.
export function formatLogDatesInText(value: string, start?: string | null, end?: string | null) {
  return value.replace(
    /((?:Handover|Prestart):\s*)(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?=\s*-\s*(?:Days|Nights))/gi,
    (_, prefix: string, date: string) => `${prefix}${formatLogEntryDateDDMMYYYY(date, start, end)}`
  );
}

export function formatDateTimeAU(value: string | null | undefined) {
  if (!value) return "TBC";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";

  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
