export function formatDateDDMMYYYY(value: string | null | undefined) {
  if (!value) return "TBC";

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}
