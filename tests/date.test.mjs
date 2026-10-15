import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDateDDMMYYYY,
  formatDateTimeAU,
  formatLogDatesInText,
  formatLogEntryDateDDMMYYYY,
  getTodayDDMMYYYY,
  parseDateDDMMYYYY,
} from "../src/lib/date.ts";

test("day-first input round-trips to ISO storage without swapping ambiguous dates", () => {
  for (const [display, iso] of [["05/06/2026", "2026-06-05"], ["15/10/2026", "2026-10-15"], ["29/02/2024", "2024-02-29"]]) {
    assert.equal(parseDateDDMMYYYY(display), iso);
    assert.equal(formatDateDDMMYYYY(iso), display);
    assert.equal(formatDateDDMMYYYY(display), display);
  }
});

test("rejects malformed, incomplete, US-only and impossible input dates", () => {
  for (const value of ["", "1/2/2026", "10/15/2026", "31/04/2026", "29/02/2025", "00/01/2026", "01/13/2026", "01/01/0000", "2026-10-15"]) {
    assert.equal(parseDateDDMMYYYY(value), null, value);
  }
  for (const value of [null, undefined, "", "invalid", "31/02/2026", "2026-02-31"]) {
    assert.equal(formatDateDDMMYYYY(value), "TBC");
  }
});

test("today uses the local calendar day even when UTC is still yesterday", () => {
  const previousTZ = process.env.TZ;
  try {
    process.env.TZ = "Australia/Perth";
    assert.equal(getTodayDDMMYYYY(new Date("2026-10-14T17:00:00Z")), "15/10/2026");
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test("saved timestamps keep padded day-first dates and their time", () => {
  const timestamp = new Date(2026, 5, 5, 13, 4, 5).toISOString();
  assert.match(formatDateTimeAU(timestamp), /^05\/06\/2026,? 1:04:05 pm$/i);
  assert.equal(formatDateDDMMYYYY(timestamp), "05/06/2026");
});

test("legacy log conversion checks calendar validity before project date range", () => {
  assert.equal(formatLogEntryDateDDMMYYYY("10/15/2026"), "15/10/2026");
  assert.equal(formatLogEntryDateDDMMYYYY("05/06/2026"), "05/06/2026");
  assert.equal(formatLogEntryDateDDMMYYYY("05/06/2026", "2026-05-01", "2026-05-31"), "06/05/2026");
  assert.equal(formatLogEntryDateDDMMYYYY("15/10/2026", "2027-01-01", "2027-12-31"), "15/10/2026");
  assert.equal(formatLogEntryDateDDMMYYYY("31/02/2026"), "TBC");
});

test("normalizes generated log headers while preserving free text", () => {
  const notes = "Handover: 2026-10-15 - Days\nPrestart: 10/15/2026 - Nights\nInspect by 2026-10-16.";
  assert.equal(formatLogDatesInText(notes), "Handover: 15/10/2026 - Days\nPrestart: 15/10/2026 - Nights\nInspect by 2026-10-16.");
});
