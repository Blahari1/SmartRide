const Rating = require("../models/Rating");
const Trip = require("../models/Trip");
const DriverProfile = require("../models/DriverProfile");
const svc = require("../services/ratingService");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const create = wrap(async (req, res) => {
  pickAllowed(req.body, ["tripId", "rating", "feedback"]);
  const doc = await svc.submit(req.user, req.body);
  res.status(201).json({ success: true, message: "Thank you for your feedback", rating: doc });
});

// Customer: own ratings + completed trips still waiting for a rating.
const mine = wrap(async (req, res) => {
  const ratings = await Rating.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(200).populate("driverId", "fullName");
  const trips = await Trip.find({ _id: { $in: ratings.map((r) => r.tripId) } }).select("date pickupTime servicePeriod");
  const byTrip = new Map(trips.map((t) => [String(t._id), t]));
  const rated = new Set(ratings.map((r) => String(r.tripId)));
  const completed = await Trip.find({ userId: req.user.id, status: "completed", driverId: { $ne: null } }).populate("driverId", "fullName").sort({ date: -1 }).limit(100);
  res.json({
    success: true,
    ratings: ratings.map((r) => ({ id: r._id, tripId: r.tripId, rating: r.rating, feedback: r.feedback, createdAt: r.createdAt, driver: r.driverId ? r.driverId.fullName : null, trip: byTrip.get(String(r.tripId)) ? { date: byTrip.get(String(r.tripId)).date, pickupTime: byTrip.get(String(r.tripId)).pickupTime, servicePeriod: byTrip.get(String(r.tripId)).servicePeriod } : null })),
    pending: completed.filter((t) => !rated.has(String(t._id))).map((t) => ({ tripId: t._id, date: t.date, pickupTime: t.pickupTime, servicePeriod: t.servicePeriod, driver: t.driverId ? t.driverId.fullName : null })),
  });
});

// Driver: ratings received for the driver's own trips. Customer identity is not disclosed.
const driverMine = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) throw new HttpError(404, "Complete your driver profile first");
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [items, summary] = await Promise.all([
    Rating.find({ driverId: profile._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    svc.summaryFor({ driverId: profile._id }),
  ]);
  const trips = await Trip.find({ _id: { $in: items.map((r) => r.tripId) } }).select("date pickupTime servicePeriod");
  const byTrip = new Map(trips.map((t) => [String(t._id), t]));
  res.json({
    success: true, summary, page, limit,
    ratings: items.map((r) => { const t = byTrip.get(String(r.tripId)); return { id: r._id, tripId: r.tripId, rating: r.rating, feedback: r.feedback, createdAt: r.createdAt, trip: t ? { date: t.date, pickupTime: t.pickupTime, servicePeriod: t.servicePeriod } : null }; }),
  });
});

// Admin: everything, filterable.
const list = wrap(async (req, res) => {
  const f = {};
  if (req.query.driverId !== undefined) f.driverId = requireId(req.query.driverId, "driver ID");
  if (req.query.rating !== undefined) {
    const n = Number(req.query.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, "rating filter must be 1-5");
    f.rating = n;
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [items, total, summary] = await Promise.all([
    Rating.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("driverId", "fullName").populate("userId", "name"),
    Rating.countDocuments(f),
    svc.summaryFor(f),
  ]);
  res.json({
    success: true, total, page, limit, summary,
    ratings: items.map((r) => ({ id: r._id, tripId: r.tripId, rating: r.rating, feedback: r.feedback, createdAt: r.createdAt, driver: r.driverId ? { id: r.driverId._id, name: r.driverId.fullName } : null, customer: r.userId ? r.userId.name : null })),
  });
});

module.exports = { create, mine, driverMine, list };
