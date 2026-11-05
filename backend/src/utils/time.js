// All service dates are Asia/Kolkata (UTC+05:30, no DST).
// Storage convention:
//   * Instants (startDate, endDate, pickupAt, dropAt)  -> UTC Date (Mongo ISODate)
//   * Service day of a trip                            -> "YYYY-MM-DD" string in IST (field `date`)
//   * Wall-clock times of a recurring schedule         -> "HH:mm" strings in IST
const IST_OFFSET_MIN = 330;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isDateStr = (s) => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(istStart(s).getTime()) && toIstDateStr(istStart(s)) === s;
const isTimeStr = (s) => typeof s === "string" && TIME_RE.test(s);

// "YYYY-MM-DD" (IST) -> Date at 00:00 IST
function istStart(dateStr) {
  return new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - IST_OFFSET_MIN * 60000);
}
// "YYYY-MM-DD" + "HH:mm" (IST) -> UTC Date
function istDateTime(dateStr, hhmm) {
  return new Date(new Date(`${dateStr}T${hhmm}:00.000Z`).getTime() - IST_OFFSET_MIN * 60000);
}
function toIstDateStr(date) {
  return new Date(date.getTime() + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}
const todayIst = () => toIstDateStr(new Date());
function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// 0 = Sunday ... 6 = Saturday, for an IST calendar date
const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

// add calendar months (IST) keeping day-of-month where possible
function addMonthsIst(date, months) {
  const s = toIstDateStr(date);
  const [y, m, d] = s.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return istStart(target.toISOString().slice(0, 10));
}

module.exports = { isDateStr, isTimeStr, istStart, istDateTime, toIstDateStr, todayIst, addDaysStr, weekdayOf, minutes, addMonthsIst };
