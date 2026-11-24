import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearch,
  shiftDate,
  chronologicalSlots,
  checkoutState,
} from "./schedule.js";
test("search is case and accent insensitive", () => {
  assert.equal(normalizeSearch("  Administração "), "administracao");
  assert.ok(
    normalizeSearch("Laboratório de Informática").includes(
      normalizeSearch("informatica"),
    ),
  );
});
test("calendar navigation handles month and year changes", () => {
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2028-03-01", -1), "2028-02-29");
});
test("agenda lists all occupied/free intervals in order without mutating input", () => {
  const occupied = [
    {
      startTime: "2026-11-24T10:00:00Z",
      endTime: "2026-11-24T12:00:00Z",
      source: "CLASS",
    },
  ];
  const available = [
    { startTime: "2026-11-24T03:00:00Z", endTime: "2026-11-24T10:00:00Z" },
  ];
  const result = chronologicalSlots({ occupied, available });
  assert.equal(result.length, 2);
  assert.equal(result[0].occupied, false);
  assert.equal(result[1].occupied, true);
  assert.equal("occupied" in occupied[0], false);
});

test("checkout requires a current reservation and available key, including exact time boundaries", () => {
  const reservation = {
    startTime: "2026-11-24T10:00:00Z",
    endTime: "2026-11-24T11:00:00Z",
  };
  assert.equal(checkoutState(null), "NONE");
  assert.equal(
    checkoutState(reservation, Date.parse("2026-11-24T09:59:59Z")),
    "FUTURE",
  );
  assert.equal(
    checkoutState(reservation, Date.parse(reservation.startTime)),
    "READY",
  );
  assert.equal(
    checkoutState(reservation, Date.parse(reservation.endTime)),
    "ENDED",
  );
  assert.equal(
    checkoutState(
      reservation,
      Date.parse(reservation.startTime),
      "CHECKED_OUT",
    ),
    "CHECKED_OUT",
  );
});

test("legacy all-day availability is clipped to 07–23 in Sao Paulo, independent of browser timezone", () => {
  const result = chronologicalSlots({
    date: "2026-11-24",
    zone: "America/Sao_Paulo",
    occupied: [],
    available: [
      { startTime: "2026-11-24T03:00:00Z", endTime: "2026-11-25T03:00:00Z" },
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].startTime, "2026-11-24T10:00:00.000Z");
  assert.equal(result[0].endTime, "2026-11-25T02:00:00.000Z");
});
test("overnight intervals disappear and intervals crossing opening time are clipped", () => {
  const result = chronologicalSlots({
    date: "2026-11-24",
    zone: "America/Sao_Paulo",
    occupied: [
      {
        startTime: "2026-11-24T09:00:00Z",
        endTime: "2026-11-24T11:00:00Z",
        source: "RESERVATION",
      },
    ],
    available: [
      { startTime: "2026-11-24T03:00:00Z", endTime: "2026-11-24T09:00:00Z" },
      { startTime: "2026-11-24T11:00:00Z", endTime: "2026-11-25T03:00:00Z" },
    ],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].startTime, "2026-11-24T10:00:00.000Z");
  assert.equal(result[1].endTime, "2026-11-25T02:00:00.000Z");
});
