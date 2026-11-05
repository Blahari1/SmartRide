const Schedule = require("../models/Schedule");
const Trip = require("../models/Trip");
const Subscription = require("../models/Subscription");
const CustomerProfile = require("../models/CustomerProfile");
const DriverProfile = require("../models/DriverProfile");
const { HttpError } = require("../utils/validate");
const T = require("../utils/time");
const { notify } = require("./notificationService");
const realtime = require("../utils/realtime");
const tracking = require("./trackingService");
const { DIRECTIONS, dirOf, dirFilter } = require("../utils/direction");

const HORIZON_DAYS = 30; // trips are materialised this many days ahead
const DEFAULT_RIDE_MIN = 60; // slot length when no dropTime is given
const OPEN = ["scheduled", "confirmed", "in_progress"];

const periodOf = (hhmm) => (T.minutes(hhmm) < 12 * 60 ? "morning" : "evening");
const slot = (pickupTime, dropTime) => {
  const s = T.minutes(pickupTime);
  const e = dropTime ? T.minutes(dropTime) : s + DEFAULT_RIDE_MIN;
  return { startMin: s, endMin: e };
};

// ---------- validation helpers ----------
function validateTimes({ pickupTime, dropTime }) {
  if (!T.isTimeStr(pickupTime)) throw new HttpError(400, "pickupTime must be HH:mm (IST, 24h)");
  if (dropTime != null) {
    if (!T.isTimeStr(dropTime)) throw new HttpError(400, "dropTime must be HH:mm (IST, 24h)");
    if (T.minutes(dropTime) <= T.minutes(pickupTime)) throw new HttpError(400, "dropTime must be after pickupTime");
  }
}
function validateDays(days) {
  if (!Array.isArray(days) || !days.length || new Set(days).size !== days.length || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw new HttpError(400, "serviceDays must be a non-empty array of unique weekday numbers 0 (Sun) - 6 (Sat)");
  }
}

// ---------- eligibility ----------
async function loadEligibleSubscription(subscriptionId) {
  await Subscription.updateMany({ _id: subscriptionId, status: "active", endDate: { $lte: new Date() } }, { $set: { status: "expired" } });
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new HttpError(404, "Subscription not found");
  if (sub.status !== "active") throw new HttpError(409, `Subscription is ${sub.status}; only active subscriptions can be scheduled`);
  return sub;
}
async function assertDriver(driverId) {
  const d = await DriverProfile.findById(driverId);
  if (!d) throw new HttpError(404, "Driver not found");
  if (d.verificationStatus !== "approved") throw new HttpError(409, "Only approved drivers can be assigned");
  if (d.availability !== "available") throw new HttpError(409, "Driver is marked unavailable");
  if (d.licenseValidUntil <= new Date()) throw new HttpError(409, "Driver's licence has expired");
  return d;
}
// ---------- date window ----------
// Dates a schedule should have trips on, limited to its own range, the subscription term and the horizon.
function windowDates(schedule, sub, { from } = {}) {
  const subStart = T.toIstDateStr(sub.startDate);
  const subEnd = T.toIstDateStr(new Date(sub.endDate.getTime() - 1)); // endDate is exclusive
  const today = T.todayIst();
  let first = [schedule.startDate, subStart, from || today].reduce((a, b) => (a > b ? a : b));
  const last = [schedule.endDate, subEnd, T.addDaysStr(today, HORIZON_DAYS)].reduce((a, b) => (a < b ? a : b));
  const out = [];
  for (let d = first; d <= last; d = T.addDaysStr(d, 1)) if (schedule.serviceDays.includes(T.weekdayOf(d))) out.push(d);
  return out;
}

// ---------- conflicts ----------
async function findConflict({ field, id, dates, startMin, endMin, ignoreScheduleId }) {
  if (!id || !dates.length) return null;
  const q = { [field]: id, date: { $in: dates }, isOpen: true, startMin: { $lt: endMin }, endMin: { $gt: startMin } };
  if (ignoreScheduleId) q.scheduleId = { $ne: ignoreScheduleId };
  return Trip.findOne(q).select("date pickupTime dropTime");
}
async function assertNoConflicts({ driverId, dates, startMin, endMin, scheduleId }) {
  const dc = await findConflict({ field: "driverId", id: driverId, dates, startMin, endMin, ignoreScheduleId: scheduleId });
  if (dc) throw new HttpError(409, `Driver already has an overlapping trip on ${dc.date} (${dc.pickupTime}${dc.dropTime ? "-" + dc.dropTime : ""})`);
}

// The customer cannot be in two trips at once (e.g. outbound and return slots must not overlap).
async function assertCustomerFree({ userId, dates, startMin, endMin, scheduleId }) {
  const c = await findConflict({ field: "userId", id: userId, dates, startMin, endMin, ignoreScheduleId: scheduleId });
  if (c) throw new HttpError(409, `Customer already has an overlapping trip on ${c.date} (${c.pickupTime}${c.dropTime ? "-" + c.dropTime : ""})`);
}

// Check the FULL recurring subscription term, not only the materialised trip horizon.
// This reserves a driver's recurring time window so accepting a long subscription cannot create
// a conflict that appears only after the first 30-day trip-generation window.
async function assertRecurringNoConflicts({ driverId, userId, serviceDays, startDate, endDate, startMin, endMin, ignoreScheduleId }) {
  const checks = [
    { field: "driverId", id: driverId, label: "Driver" },
    { field: "userId", id: userId, label: "Customer" },
  ];
  for (const check of checks) {
    if (!check.id) continue;
    const filter = {
      [check.field]: check.id,
      isOpen: true,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    };
    if (ignoreScheduleId) filter._id = { $ne: ignoreScheduleId };
    const existing = await Schedule.find(filter);
    for (const item of existing) {
      const sharedDay = (item.serviceDays || []).some((day) => serviceDays.includes(day));
      if (!sharedDay) continue;
      const current = slot(item.pickupTime, item.dropTime);
      if (current.startMin < endMin && current.endMin > startMin) {
        throw new HttpError(409, `${check.label} already has an overlapping recurring commute (${item.pickupTime}${item.dropTime ? `–${item.dropTime}` : ""})`);
      }
    }
  }
}

// Bring Trip documents in line with the schedule rule (future, not-yet-started trips only).
async function syncTrips(schedule, sub) {
  const today = T.todayIst();
  const wanted = schedule.status === "cancelled" ? [] : windowDates(schedule, sub);
  const { startMin, endMin } = slot(schedule.pickupTime, schedule.dropTime);
  const existing = await Trip.find({ scheduleId: schedule._id, date: { $gte: today } });
  const byDate = new Map(existing.map((t) => [t.date, t]));
  const tripStatus = schedule.status === "confirmed" ? "confirmed" : "scheduled";

  // remove trips no longer wanted (only if not started)
  for (const t of existing) {
    if (!wanted.includes(t.date) && ["scheduled", "confirmed"].includes(t.status)) { t.status = "cancelled"; await t.save(); }
  }
  for (const date of wanted) {
    const fields = {
      servicePeriod: schedule.servicePeriod, direction: dirOf(schedule), pickupTime: schedule.pickupTime, dropTime: schedule.dropTime,
      pickupAt: T.istDateTime(date, schedule.pickupTime),
      dropAt: schedule.dropTime ? T.istDateTime(date, schedule.dropTime) : null,
      startMin, endMin,
      pickupLocation: schedule.pickupLocation, dropLocation: schedule.dropLocation,
      driverId: schedule.driverId,
    };
    const t = byDate.get(date);
    if (!t) {
      await Trip.create({ scheduleId: schedule._id, userId: schedule.userId, subscriptionId: schedule.subscriptionId, date, status: tripStatus, ...fields });
    } else if (["scheduled", "confirmed"].includes(t.status)) {
      Object.assign(t, fields, { status: tripStatus });
      await t.save();
    }
  }
}

// ---------- create ----------
async function createSchedule(input, adminId) {
  const { subscriptionId, pickupTime, dropTime = null, serviceDays, startDate, endDate, driverId } = input;
  const direction = input.direction === undefined || input.direction === null ? "outbound" : input.direction;
  if (!DIRECTIONS.includes(direction)) throw new HttpError(400, 'direction must be "outbound" or "return"');
  validateTimes({ pickupTime, dropTime });
  validateDays(serviceDays);
  if (!T.isDateStr(startDate) || !T.isDateStr(endDate)) throw new HttpError(400, "startDate and endDate must be valid YYYY-MM-DD dates");
  if (endDate < startDate) throw new HttpError(400, "endDate must not be before startDate");

  const sub = await loadEligibleSubscription(subscriptionId);
  const subStart = T.toIstDateStr(sub.startDate);
  const subEnd = T.toIstDateStr(new Date(sub.endDate.getTime() - 1));
  if (startDate < subStart || endDate > subEnd) {
    throw new HttpError(409, `Schedule must fall within the subscription term (${subStart} to ${subEnd})`);
  }

  // A distance-priced subscription only covers the directions and weekdays the customer was quoted and pays for.
  const fareSnapshot = sub.fareSnapshot;
  if (fareSnapshot && Array.isArray(fareSnapshot.directions) && !fareSnapshot.directions.includes(direction)) {
    throw new HttpError(409, `This subscription includes ${fareSnapshot.directions.join(" + ")} only; the ${direction} direction was not requested`);
  }
  if (fareSnapshot && Array.isArray(fareSnapshot.serviceDays) && !serviceDays.every((d) => fareSnapshot.serviceDays.includes(d))) {
    throw new HttpError(409, "Service days must be within the weekdays selected in the commute request");
  }
  const profile = await CustomerProfile.findOne({ userId: sub.userId });
  const loc = (l) => l && l.address && l.address.trim();
  if (!profile || !loc(profile.pickupLocation) || !loc(profile.dropLocation)) {
    throw new HttpError(409, "Customer must save both pickup and drop locations before scheduling");
  }
  const snap = (l) => ({ address: l.address, landmark: l.landmark || "", latitude: l.latitude, longitude: l.longitude });
  // profile.pickupLocation = Home, profile.dropLocation = College/Office. Return trips run College/Office -> Home.
  const [fromLoc, toLoc] = direction === "return" ? [profile.dropLocation, profile.pickupLocation] : [profile.pickupLocation, profile.dropLocation];

  const servicePeriod = periodOf(pickupTime);
  if (await Schedule.exists({ subscriptionId: sub._id, isOpen: true, ...dirFilter(direction) })) {
    throw new HttpError(409, `This subscription already has an open ${direction} schedule`);
  }

  let driver = null;
  if (driverId) driver = await assertDriver(driverId);

  const schedule = new Schedule({
    userId: sub.userId, subscriptionId: sub._id,
    pickupLocation: snap(fromLoc), dropLocation: snap(toLoc), direction,
    pickupTime, dropTime, servicePeriod, serviceDays, startDate, endDate,
    driverId: driver?._id || null,
    status: driver ? "confirmed" : "scheduled", createdBy: adminId,
  });

  const dates = windowDates(schedule, sub);
  if (!dates.length) throw new HttpError(409, "No service dates fall inside the chosen range and subscription term");
  const { startMin, endMin } = slot(pickupTime, dropTime);
  await assertRecurringNoConflicts({
    driverId: schedule.driverId, userId: schedule.userId,
    serviceDays: schedule.serviceDays, startDate: schedule.startDate, endDate: schedule.endDate,
    startMin, endMin,
  });
  await assertNoConflicts({ driverId: schedule.driverId, dates, startMin, endMin });
  await assertCustomerFree({ userId: sub.userId, dates, startMin, endMin });

  try {
    await schedule.save();
    await syncTrips(schedule, sub);
  } catch (e) {
    await Trip.deleteMany({ scheduleId: schedule._id, status: { $in: ["scheduled", "confirmed"] } }); // roll back partial work
    await Schedule.deleteOne({ _id: schedule._id, createdBy: adminId, status: { $in: ["scheduled", "confirmed"] } });
    if (e.code === 11000) throw new HttpError(409, "Conflicts with an existing schedule (duplicate period or driver time slot)");
    throw e;
  }
  return schedule;
}

// Creates the outbound and the return schedule for ONE subscription in one call.
// If the return schedule fails, the just-created outbound schedule and its un-started trips are removed again.
async function createCommute(input, adminId) {
  const { returnPickupTime, returnDropTime = null, returnDriverId, ...outInput } = input;
  const outbound = await createSchedule({ ...outInput, direction: "outbound" }, adminId);
  try {
    const ret = await createSchedule({
      subscriptionId: outInput.subscriptionId, serviceDays: outInput.serviceDays, startDate: outInput.startDate, endDate: outInput.endDate,
      pickupTime: returnPickupTime, dropTime: returnDropTime,
      driverId: returnDriverId || outInput.driverId, direction: "return",
    }, adminId);
    return { outbound, return: ret };
  } catch (e) {
    await Trip.deleteMany({ scheduleId: outbound._id, status: { $in: ["scheduled", "confirmed"] } });
    await Schedule.deleteOne({ _id: outbound._id, createdBy: adminId, status: { $in: ["scheduled", "confirmed"] } });
    throw e;
  }
}

// ---------- update times / days / range ----------
async function cancelSchedule(schedule, reason = "") {
  if (!schedule.isOpen) throw new HttpError(409, `Schedule is already ${schedule.status}`);
  schedule.status = "cancelled";
  schedule.cancelledAt = new Date();
  schedule.cancelReason = reason;
  await schedule.save();
  // Future un-started trips are cancelled; in-progress / completed trips are history and stay untouched.
  await Trip.updateMany({ scheduleId: schedule._id, status: { $in: ["scheduled", "confirmed"] } }, { $set: { status: "cancelled", isOpen: false, cancelledAt: new Date(), cancelReason: reason } });
  await notify(schedule.userId, { type: "schedule_cancelled", category: "schedule", title: "Schedule cancelled", message: `Your pickup and drop schedule was cancelled${reason ? `: ${reason}` : "."} Upcoming trips were cancelled.`, related: { kind: "schedule", id: schedule._id } });
  if (schedule.driverId) {
    const d = await DriverProfile.findById(schedule.driverId);
    if (d) await notify(d.userId, { type: "schedule_cancelled", category: "schedule", title: "Schedule cancelled", message: "A schedule you were assigned to was cancelled; its upcoming trips were removed.", related: { kind: "schedule", id: schedule._id } });
  }
  return schedule;
}
async function cancelForSubscription(subscriptionId, reason) {
  const open = await Schedule.find({ subscriptionId, isOpen: true });
  for (const s of open) await cancelSchedule(s, reason);
}

// Extend the materialised window for every open schedule (idempotent). Safe to call from an admin endpoint or a cron.
async function generateTrips(scheduleId) {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new HttpError(404, "Schedule not found");
  if (!schedule.isOpen) throw new HttpError(409, `Schedule is ${schedule.status}`);
  const sub = await loadEligibleSubscription(schedule.subscriptionId);
  const dates = windowDates(schedule, sub);
  const { startMin, endMin } = slot(schedule.pickupTime, schedule.dropTime);
  await assertNoConflicts({ driverId: schedule.driverId, dates, startMin, endMin, scheduleId: schedule._id });
  await syncTrips(schedule, sub);
  return schedule;
}

// ---------- trip status machine ----------
const TRIP_FLOW = {
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const DRIVER_MAY = { confirmed: ["in_progress"], in_progress: ["completed"] };

async function changeTripStatus(trip, nextStatus, actor, { reason = "" } = {}) {
  if (!Object.keys(TRIP_FLOW).includes(nextStatus)) throw new HttpError(400, "Invalid status");
  if (!TRIP_FLOW[trip.status].includes(nextStatus)) throw new HttpError(409, `Cannot move a trip from ${trip.status} to ${nextStatus}`);
  if (actor.role === "driver") {
    if (!(DRIVER_MAY[trip.status] || []).includes(nextStatus)) throw new HttpError(403, "Drivers may only start or complete their confirmed trips");
    if (nextStatus === "in_progress" && trip.date !== T.todayIst()) throw new HttpError(409, "A trip can only be started on its service date");
  }
  if (nextStatus === "confirmed" && !trip.driverId) throw new HttpError(409, "A verified driver must accept the commute before confirming");
  if (nextStatus === "in_progress") {
    // A driver drives one trip at a time (also enforced by the one_active_trip_per_driver index).
    if (await Trip.exists({ driverId: trip.driverId, status: "in_progress", _id: { $ne: trip._id } })) throw new HttpError(409, "Finish your current trip before starting another");
  }
  const was = trip.status;
  trip.status = nextStatus;
  if (nextStatus === "in_progress") trip.startedAt = new Date();
  if (nextStatus === "completed") trip.completedAt = new Date();
  if (nextStatus === "cancelled") { trip.cancelledAt = new Date(); trip.cancelReason = reason; }
  try {
    await trip.save();
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, "Finish your current trip before starting another");
    throw e;
  }

  // Everything below runs only after the status change was stored, so no one is told about a change that did not happen.
  if (nextStatus === "completed" || nextStatus === "cancelled") await tracking.endTracking(trip, nextStatus === "completed" ? "Trip completed" : "Trip cancelled");
  realtime.tripStatus(trip);
  const when = `${trip.date} ${trip.pickupTime}`;
  const rel = { kind: "trip", id: trip._id };
  const msg = {
    in_progress: ["trip_started", "Trip started", `Your trip on ${when} has started. You can track your driver live.`],
    completed: ["trip_completed", "Trip completed", `Your trip on ${when} is complete. Please rate your driver.`],
    cancelled: ["trip_cancelled", "Trip cancelled", `Your trip on ${when} was cancelled${reason ? `: ${reason}` : "."}`],
    confirmed: ["trip_assigned", "Trip confirmed", `Your trip on ${when} is confirmed with your assigned driver.`],
  }[nextStatus];
  if (msg) await notify(trip.userId, { type: msg[0], category: "trip", title: msg[1], message: msg[2], related: rel });
  if (trip.driverId && (nextStatus === "cancelled" || (nextStatus === "confirmed" && actor.role !== "driver"))) {
    const d = await DriverProfile.findById(trip.driverId);
    if (d && String(d.userId) !== String(actor.id)) {
      await notify(d.userId, nextStatus === "cancelled"
        ? { type: "trip_cancelled", category: "trip", title: "Trip cancelled", message: `The trip on ${when} was cancelled${reason ? `: ${reason}` : "."}`, related: rel }
        : { type: "trip_assigned", category: "trip", title: "Trip assigned", message: `You are assigned to the trip on ${when}.`, related: rel });
    }
  }
  void was;
  return trip;
}

module.exports = {
  createCommute, createSchedule, cancelSchedule, cancelForSubscription, generateTrips, changeTripStatus, HORIZON_DAYS, OPEN, assertRecurringNoConflicts };
