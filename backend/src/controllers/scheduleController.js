const Schedule = require("../models/Schedule");
const Trip = require("../models/Trip");
const DriverProfile = require("../models/DriverProfile");
const svc = require("../services/schedulingService");
const T = require("../utils/time");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const TRIP_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled"];
const DRIVER_PUBLIC = "fullName phone";

// ---------- admin ----------
const list = wrap(async (req, res) => {
  const f = {};
  for (const [q, k] of [["driverId", "driverId"], ["userId", "userId"]]) {
    if (req.query[q] !== undefined) f[k] = requireId(req.query[q], q);
  }
  if (req.query.status !== undefined) {
    if (!["scheduled", "confirmed", "completed", "cancelled"].includes(req.query.status)) throw new HttpError(400, "Invalid status filter");
    f.status = req.query.status;
  }
  const schedules = await Schedule.find(f)
    .populate("userId", "name phone email").populate("driverId", DRIVER_PUBLIC)
    .sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: schedules.length, schedules });
});

const listTrips = wrap(async (req, res) => {
  const f = {};
  const { date, from, to, status } = req.query;
  if (date !== undefined) { if (!T.isDateStr(date)) throw new HttpError(400, "date must be YYYY-MM-DD"); f.date = date; }
  else if (from !== undefined || to !== undefined) {
    f.date = {};
    if (from !== undefined) { if (!T.isDateStr(from)) throw new HttpError(400, "from must be YYYY-MM-DD"); f.date.$gte = from; }
    if (to !== undefined) { if (!T.isDateStr(to)) throw new HttpError(400, "to must be YYYY-MM-DD"); f.date.$lte = to; }
  }
  if (status !== undefined) { if (!TRIP_STATUSES.includes(status)) throw new HttpError(400, "Invalid status filter"); f.status = status; }
  if (req.query.driverId !== undefined) f.driverId = requireId(req.query.driverId, "driverId");
  const trips = await Trip.find(f).populate("userId", "name phone").populate("driverId", DRIVER_PUBLIC).sort({ date: 1, startMin: 1 }).limit(300);
  res.json({ success: true, count: trips.length, trips });
});

async function loadSchedule(id) {
  requireId(id, "schedule ID");
  const s = await Schedule.findById(id);
  if (!s) throw new HttpError(404, "Schedule not found");
  return s;
}

const cancel = wrap(async (req, res) => {
  pickAllowed(req.body, ["reason"]);
  const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
  const s = await svc.cancelSchedule(await loadSchedule(req.params.id), reason);
  res.json({ success: true, message: "Schedule cancelled", schedule: s });
});

const generate = wrap(async (req, res) => {
  const s = await svc.generateTrips(req.params.id && (await loadSchedule(req.params.id))._id);
  res.json({ success: true, message: `Trips generated up to ${svc.HORIZON_DAYS} days ahead`, schedule: s });
});

// ---------- customer ----------
function customerTripView(t) {
  const assigned = !!t.driverId;
  return {
    id: t._id, scheduleId: t.scheduleId, date: t.date, servicePeriod: t.servicePeriod, direction: t.direction || "outbound",
    pickupTime: t.pickupTime, dropTime: t.dropTime, status: t.status,
    pickupLocation: t.pickupLocation, dropLocation: t.dropLocation,
    driver: assigned ? { name: t.driverId.fullName, phone: t.driverId.phone } : null,
  };
}

const mine = wrap(async (req, res) => {
  const f = { userId: req.user.id };
  if (req.query.include !== "all") { f.date = { $gte: T.todayIst() }; f.status = { $ne: "cancelled" }; }
  const [trips, schedules] = await Promise.all([
    Trip.find(f).populate("driverId", DRIVER_PUBLIC).sort({ date: 1, startMin: 1 }).limit(120),
    Schedule.find({ userId: req.user.id }).sort({ createdAt: -1 }).select("pickupTime dropTime serviceDays startDate endDate status servicePeriod direction pickupLocation dropLocation"),
  ]);
  res.json({ success: true, schedules, trips: trips.map(customerTripView) });
});

const getOne = wrap(async (req, res) => {
  const s = await loadSchedule(req.params.id);
  if (req.user.role !== "admin" && s.userId.toString() !== req.user.id) throw new HttpError(404, "Schedule not found");
  await s.populate([
    { path: "userId", select: "name phone" },
    { path: "driverId", select: DRIVER_PUBLIC },
  ]);
  const trips = await Trip.find({ scheduleId: s._id, date: { $gte: T.todayIst() } }).sort({ date: 1 }).limit(60);
  if (req.user.role === "customer") {
    const assigned = !!s.driverId;
    return res.json({
      success: true,
      schedule: {
        id: s._id, pickupTime: s.pickupTime, dropTime: s.dropTime, serviceDays: s.serviceDays, startDate: s.startDate, endDate: s.endDate,
        status: s.status, pickupLocation: s.pickupLocation, dropLocation: s.dropLocation,
        driver: assigned ? { name: s.driverId.fullName, phone: s.driverId.phone } : null,
      },
      trips: trips.map((t) => ({ id: t._id, date: t.date, status: t.status, pickupTime: t.pickupTime, dropTime: t.dropTime })),
    });
  }
  res.json({ success: true, schedule: s, trips });
});

// ---------- driver ----------
async function approvedProfile(userId) {
  const p = await DriverProfile.findOne({ userId });
  if (!p) throw new HttpError(404, "Complete your driver profile first");
  if (p.verificationStatus !== "approved") throw new HttpError(403, "Your account is not approved yet");
  return p;
}

const driverMine = wrap(async (req, res) => {
  const p = await approvedProfile(req.user.id);
  const f = { driverId: p._id };
  if (req.query.date !== undefined) { if (!T.isDateStr(req.query.date)) throw new HttpError(400, "date must be YYYY-MM-DD"); f.date = req.query.date; }
  else if (req.query.include !== "all") { f.date = { $gte: T.todayIst() }; f.status = { $ne: "cancelled" }; }
  if (req.query.status !== undefined) { if (!TRIP_STATUSES.includes(req.query.status)) throw new HttpError(400, "Invalid status filter"); f.status = req.query.status; }
  const trips = await Trip.find(f).populate("userId", "name phone").sort(req.query.order === "desc" ? { date: -1, startMin: -1 } : { date: 1, startMin: 1 }).limit(120);
  // Only what the driver strictly needs for the trip: first name + phone, locations, times.
  res.json({
    success: true,
    trips: trips.map((t) => ({
      id: t._id, date: t.date, servicePeriod: t.servicePeriod, direction: t.direction || "outbound", pickupTime: t.pickupTime, dropTime: t.dropTime, status: t.status,
      pickupLocation: t.pickupLocation, dropLocation: t.dropLocation,
      customer: t.userId ? { name: t.userId.name, phone: t.userId.phone } : null,
    })),
  });
});

// ---------- trip status (admin or the assigned driver) ----------
const setTripStatus = wrap(async (req, res) => {
  pickAllowed(req.body, ["status", "reason"]);
  requireId(req.params.tripId, "trip ID");
  if (req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.length > 300)) throw new HttpError(400, "reason must be text up to 300 characters");
  const trip = await Trip.findById(req.params.tripId);
  if (!trip) throw new HttpError(404, "Trip not found");
  if (req.user.role === "driver") {
    const p = await approvedProfile(req.user.id);
    if (!trip.driverId || !trip.driverId.equals(p._id)) throw new HttpError(404, "Trip not found"); // never reveal other drivers' trips
  }
  await svc.changeTripStatus(trip, req.body.status, req.user, { reason: (req.body.reason || "").trim() });
  res.json({ success: true, message: `Trip is now ${trip.status}`, trip: { id: trip._id, date: trip.date, status: trip.status } });
});

module.exports = { list, listTrips, cancel, generate, mine, getOne, driverMine, setTripStatus };
