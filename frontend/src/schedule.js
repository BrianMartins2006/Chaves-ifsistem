export const normalizeSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
export function shiftDate(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
function operatingBoundary(date, hour, zone) {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour);
  let instant = wall;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    instant +=
      wall -
      Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  return instant;
}
export function chronologicalSlots(availability) {
  const slots = [
    ...availability.occupied.map((slot) => ({ ...slot, occupied: true })),
    ...availability.available.map((slot) => ({ ...slot, occupied: false })),
  ];
  // Protect the displayed agenda and the "Usar horário" action against older APIs.
  const start = availability.date
    ? operatingBoundary(
        availability.date,
        7,
        availability.zone || "America/Sao_Paulo",
      )
    : -Infinity;
  const end = availability.date
    ? operatingBoundary(
        availability.date,
        23,
        availability.zone || "America/Sao_Paulo",
      )
    : Infinity;
  return slots
    .map((slot) => ({
      ...slot,
      startTime: new Date(
        Math.max(start, Date.parse(slot.startTime)),
      ).toISOString(),
      endTime: new Date(Math.min(end, Date.parse(slot.endTime))).toISOString(),
    }))
    .filter((slot) => slot.startTime < slot.endTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function checkoutState(reservation, now = Date.now(), keyStatus) {
  if (!reservation) return "NONE";
  if (now < Date.parse(reservation.startTime)) return "FUTURE";
  if (now >= Date.parse(reservation.endTime)) return "ENDED";
  if (keyStatus === "CHECKED_OUT") return "CHECKED_OUT";
  return "READY";
}
