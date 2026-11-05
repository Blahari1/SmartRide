const Trip = require("../models/Trip");
const Rating = require("../models/Rating");
const T = require("../utils/time");
const tracking = require("../services/trackingService");
const { HttpError, requireId, wrap } = require("../utils/validate");

const STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled"];
const DRIVER_PUBLIC = "fullName phone";
const CONFIRMED = ["confirmed", "in_progress", "completed"];

// Customer: own trips with filters + pagination (history, upcoming, completed).
const mine = wrap(async (req, res) => {
  const f = { userId: req.user.id };
  const { status, from, to } = req.query;
  if (status !== undefined) { if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid status filter"); f.status = status; }
  if (from !== undefined || to !== undefined) {
    f.date = {};
    if (from !== undefined) { if (!T.isDateStr(from)) throw new HttpError(400, "from must be YYYY-MM-DD"); f.date.$gte = from; }
    if (to !== undefined) { if (!T.isDateStr(to)) throw new HttpError(400, "to must be YYYY-MM-DD"); f.date.$lte = to; }
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const order = req.query.order === "asc" ? 1 : -1;
  const [trips, total] = await Promise.all([
    Trip.find(f).populate("driverId", DRIVER_PUBLIC).sort({ date: order, startMin: order }).skip((page - 1) * limit).limit(limit),
    Trip.countDocuments(f),
  ]);
  const rated = new Set((await Rating.find({ tripId: { $in: trips.map((t) => t._id) } }).select("tripId")).map((r) => String(r.tripId)));
  res.json({
    success: true, total, page, limit,
    trips: trips.map((t) => ({
      id: t._id, date: t.date, servicePeriod: t.servicePeriod, direction: t.direction || "outbound", pickupTime: t.pickupTime, dropTime: t.dropTime, status: t.status,
      pickupLocation: t.pickupLocation, dropLocation: t.dropLocation,
      driver: CONFIRMED.includes(t.status) && t.driverId ? { name: t.driverId.fullName, phone: t.driverId.phone } : null,
      rated: rated.has(String(t._id)), canRate: t.status === "completed" && !!t.driverId && !rated.has(String(t._id)),
    })),
  });
});

// Role-scoped detail. The same authorization used by tracking: owner customer, assigned driver, any admin.
const getOne = wrap(async (req, res) => {
  requireId(req.params.id, "trip ID");
  const { trip } = await tracking.authorizeTrip(req.user, req.params.id);
  await trip.populate([
    { path: "driverId", select: DRIVER_PUBLIC },
    ...(req.user.role === "customer" ? [] : [{ path: "userId", select: "name phone email" }]),
  ]);
  const rating = await Rating.findOne({ tripId: trip._id });
  const base = {
    id: trip._id, scheduleId: trip.scheduleId, subscriptionId: trip.subscriptionId, date: trip.date, servicePeriod: trip.servicePeriod, direction: trip.direction || "outbound",
    pickupTime: trip.pickupTime, dropTime: trip.dropTime, status: trip.status, pickupLocation: trip.pickupLocation, dropLocation: trip.dropLocation,
    startedAt: trip.startedAt, completedAt: trip.completedAt, cancelledAt: trip.cancelledAt, cancelReason: trip.cancelReason,
    rating: rating ? { id: rating._id, rating: rating.rating, feedback: rating.feedback, createdAt: rating.createdAt } : null,
  };
  if (req.user.role === "customer") {
    const visible = CONFIRMED.includes(trip.status);
    return res.json({
      success: true,
      trip: { ...base, driver: visible && trip.driverId ? { name: trip.driverId.fullName, phone: trip.driverId.phone } : null, canRate: trip.status === "completed" && !!trip.driverId && !rating },
    });
  }
  const driver = trip.driverId ? { id: trip.driverId._id, name: trip.driverId.fullName, phone: trip.driverId.phone } : null;
  res.json({
    success: true,
    trip: { ...base, customer: trip.userId ? { id: trip.userId._id, name: trip.userId.name, phone: trip.userId.phone, ...(req.user.role === "admin" ? { email: trip.userId.email } : {}) } : null, driver },
  });
});

module.exports = { mine, getOne };
