const User = require("../models/User");
const DriverProfile = require("../models/DriverProfile");
const Subscription = require("../models/Subscription");
const Schedule = require("../models/Schedule");
const Trip = require("../models/Trip");
const Rating = require("../models/Rating");
const Notification = require("../models/Notification");
const CustomerProfile = require("../models/CustomerProfile");
const ratings = require("./ratingService");
const subs = require("./subscriptionService");
const T = require("../utils/time");
const { HttpError } = require("../utils/validate");

const byKey = (rows, keys, init = 0) => {
  const out = Object.fromEntries(keys.map((k) => [k, init]));
  rows.forEach((r) => { out[r._id] = r.n; });
  return out;
};
const groupCount = (Model, field, match = {}) => Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);

// ---------------------------------------------------------------- admin dashboard (all numbers come from MongoDB)
async function adminDashboard() {
  await subs.expireOnly({});
  const today = T.todayIst();
  const from = T.addDaysStr(today, -13);
  const [customers, driverStatus, subStatus, tripStatus, upcomingSchedules, unassignedTrips, todaysTrips, tripDays, recentFeedback, rating] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    groupCount(DriverProfile, "verificationStatus"),
    groupCount(Subscription, "status"),
    groupCount(Trip, "status"),
    Schedule.countDocuments({ isOpen: true, endDate: { $gte: today } }),
    Trip.countDocuments({ date: { $gte: today }, isOpen: true, driverId: null }),
    Trip.countDocuments({ date: today, status: { $ne: "cancelled" } }),
    Trip.aggregate([{ $match: { date: { $gte: from, $lte: today } } }, { $group: { _id: { date: "$date", status: "$status" }, n: { $sum: 1 } } }]),
    Rating.find().sort({ createdAt: -1 }).limit(5).populate("driverId", "fullName").populate("userId", "name"),
    ratings.summaryFor({}),
  ]);
  const d = byKey(driverStatus, ["pending", "approved", "rejected"]);
  const s = byKey(subStatus, ["pending", "active", "cancelled", "expired"]);
  const tr = byKey(tripStatus, ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]);
  const days = Array.from({ length: 14 }, (_, i) => T.addDaysStr(from, i));
  const series = days.map((date) => ({ date, completed: 0, cancelled: 0, other: 0 }));
  tripDays.forEach((r) => {
    const row = series.find((x) => x.date === r._id.date);
    if (!row) return;
    if (r._id.status === "completed") row.completed += r.n; else if (r._id.status === "cancelled") row.cancelled += r.n; else row.other += r.n;
  });
  return {
    stats: {
      totalCustomers: customers,
      totalDrivers: d.pending + d.approved + d.rejected, pendingDrivers: d.pending, approvedDrivers: d.approved, rejectedDrivers: d.rejected,
      activeSubscriptions: s.active, pendingSubscriptions: s.pending,
      upcomingSchedules, activeTrips: tr.in_progress, completedTrips: tr.completed, cancelledTrips: tr.cancelled,
      todaysTrips, unassignedUpcomingTrips: unassignedTrips,
      averageRating: rating.average, totalRatings: rating.count,
    },
    charts: {
      tripsLast14Days: series,
      subscriptionsByStatus: s, driversByStatus: d, tripsByStatus: tr,
      ratingDistribution: rating.distribution,
    },
    recentFeedback: recentFeedback.map((r) => ({ id: r._id, rating: r.rating, feedback: r.feedback, createdAt: r.createdAt, driver: r.driverId ? r.driverId.fullName : null, customer: r.userId ? r.userId.name : null })),
  };
}

// ---------------------------------------------------------------- admin reports (date range, IST calendar days)
async function adminReport({ from, to }) {
  const today = T.todayIst();
  const end = to || today;
  const start = from || T.addDaysStr(end, -29);
  if (!T.isDateStr(start) || !T.isDateStr(end)) throw new HttpError(400, "from and to must be valid YYYY-MM-DD dates");
  if (start > end) throw new HttpError(400, "from must not be after to");
  if ((new Date(end) - new Date(start)) / 86400000 > 366) throw new HttpError(400, "Date range is limited to 366 days");
  const startAt = T.istStart(start), endAt = T.istStart(T.addDaysStr(end, 1)); // [start, end+1)
  const created = { createdAt: { $gte: startAt, $lt: endAt } };

  const [tripStatus, tripDay, subByStatus, subByPlan, completedByDriver, ratingSummary, ratingByDriver] = await Promise.all([
    groupCount(Trip, "status", { date: { $gte: start, $lte: end } }),
    Trip.aggregate([{ $match: { date: { $gte: start, $lte: end } } }, { $group: { _id: { date: "$date", status: "$status" }, n: { $sum: 1 } } }]),
    groupCount(Subscription, "status", created),
    Subscription.aggregate([{ $match: created }, { $group: { _id: "$planSnapshot.name", n: { $sum: 1 }, paise: { $sum: "$planSnapshot.pricePaise" } } }]),
    Trip.aggregate([{ $match: { date: { $gte: start, $lte: end }, status: "completed", driverId: { $ne: null } } }, { $group: { _id: "$driverId", n: { $sum: 1 } } }]),
    ratings.summaryFor(created),
    Rating.aggregate([{ $match: created }, { $group: { _id: "$driverId", n: { $sum: 1 }, total: { $sum: "$rating" } } }]),
  ]);

  const driverIds = [...new Set([...completedByDriver.map((r) => String(r._id)), ...ratingByDriver.map((r) => String(r._id))])];
  const drivers = await DriverProfile.find({ _id: { $in: driverIds } }).select("fullName");
  const name = new Map(drivers.map((x) => [String(x._id), x.fullName]));
  const rated = new Map(ratingByDriver.map((r) => [String(r._id), r]));
  const driverRows = driverIds.map((id) => {
    const done = completedByDriver.find((r) => String(r._id) === id);
    const rr = rated.get(id);
    return { driverId: id, name: name.get(id) || "Unknown", completedTrips: done ? done.n : 0, ratings: rr ? rr.n : 0, averageRating: rr ? Math.round((rr.total / rr.n) * 100) / 100 : null };
  }).sort((a, b) => b.completedTrips - a.completedTrips);

  const days = [];
  for (let d = start; d <= end; d = T.addDaysStr(d, 1)) days.push(d);
  const series = days.map((date) => ({ date, completed: 0, cancelled: 0, other: 0 }));
  const idx = new Map(series.map((r) => [r.date, r]));
  tripDay.forEach((r) => { const row = idx.get(r._id.date); if (!row) return; if (r._id.status === "completed") row.completed += r.n; else if (r._id.status === "cancelled") row.cancelled += r.n; else row.other += r.n; });

  return {
    range: { from: start, to: end },
    trips: { byStatus: byKey(tripStatus, ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]), byDay: series },
    subscriptions: { byStatus: byKey(subByStatus, ["pending", "active", "cancelled", "expired"]), byPlan: subByPlan.map((r) => ({ plan: r._id, count: r.n, valuePaise: r.paise })) },
    ratings: ratingSummary,
    drivers: driverRows,
  };
}

// ---------------------------------------------------------------- customer dashboard
async function customerDashboard(userId) {
  await subs.expireDue({ userId });
  const today = T.todayIst();
  const POP_D = "fullName phone";
  const [history, profile, upcoming, active, recent, notifications, unread, completedIds, rated] = await Promise.all([
    Subscription.find({ userId }).sort({ createdAt: -1 }),
    CustomerProfile.findOne({ userId }),
    Trip.find({ userId, date: { $gte: today }, status: { $in: ["scheduled", "confirmed", "in_progress"] } }).populate("driverId", POP_D).sort({ date: 1, startMin: 1 }).limit(6),
    Trip.findOne({ userId, status: "in_progress" }).populate("driverId", POP_D),
    Trip.find({ userId, status: "completed" }).populate("driverId", POP_D).sort({ date: -1 }).limit(5),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(5),
    Notification.countDocuments({ userId, isRead: false }),
    Trip.find({ userId, status: "completed", driverId: { $ne: null } }).sort({ date: -1 }).limit(30).select("_id date pickupTime servicePeriod driverId"),
    Rating.find({ userId }).select("tripId"),
  ]);
  const current = history.find((s) => s.status === "active") || history.find((s) => s.status === "pending") || null;
  const ratedSet = new Set(rated.map((r) => String(r.tripId)));
  const visible = (t) => (t && ["confirmed", "in_progress", "completed"].includes(t.status) ? t : null);
  const shapeTrip = (t) => ({
    id: t._id, date: t.date, servicePeriod: t.servicePeriod, pickupTime: t.pickupTime, dropTime: t.dropTime, status: t.status,
    pickupLocation: t.pickupLocation, dropLocation: t.dropLocation,
    driver: visible(t) && t.driverId ? { name: t.driverId.fullName, phone: t.driverId.phone } : null,
  });
  const next = upcoming[0] || null;
  return {
    subscription: current,
    profile: { pickupLocation: profile ? profile.pickupLocation : null, dropLocation: profile ? profile.dropLocation : null },
    nextTrip: next ? shapeTrip(next) : null,
    activeTrip: active ? shapeTrip(active) : null,
    upcomingTrips: upcoming.map(shapeTrip),
    recentTrips: recent.map(shapeTrip),
    pendingRatings: completedIds.filter((t) => !ratedSet.has(String(t._id))).slice(0, 5).map((t) => ({ tripId: t._id, date: t.date, pickupTime: t.pickupTime, servicePeriod: t.servicePeriod })),
    notifications, unreadNotifications: unread,
  };
}

// ---------------------------------------------------------------- driver dashboard
async function driverDashboard(profile) {
  const today = T.todayIst();
  const OPEN = ["scheduled", "confirmed", "in_progress"];
  const [todays, upcomingCount, completed, active, recentRatings, rating, notifications, unread, customerIds, nextTrips] = await Promise.all([
    Trip.countDocuments({ driverId: profile._id, date: today, status: { $ne: "cancelled" } }),
    Trip.countDocuments({ driverId: profile._id, date: { $gte: today }, status: { $in: OPEN } }),
    Trip.countDocuments({ driverId: profile._id, status: "completed" }),
    Trip.findOne({ driverId: profile._id, status: "in_progress" }).populate("userId", "name phone"),
    Rating.find({ driverId: profile._id }).sort({ createdAt: -1 }).limit(5),
    ratings.summaryFor({ driverId: profile._id }),
    Notification.find({ userId: profile.userId }).sort({ createdAt: -1 }).limit(5),
    Notification.countDocuments({ userId: profile.userId, isRead: false }),
    assignedCustomerIds(profile._id),
    Trip.find({ driverId: profile._id, date: { $gte: today }, status: { $in: OPEN } }).populate("userId", "name phone").sort({ date: 1, startMin: 1 }).limit(5),
  ]);
  const tripView = (t) => ({ id: t._id, date: t.date, servicePeriod: t.servicePeriod, pickupTime: t.pickupTime, dropTime: t.dropTime, status: t.status, pickupLocation: t.pickupLocation, dropLocation: t.dropLocation, customer: t.userId ? { name: t.userId.name, phone: t.userId.phone } : null });
  return {
    profile,
    stats: { todayTrips: todays, upcomingTrips: upcomingCount, completedTrips: completed, assignedCustomers: customerIds.length },
    activeTrip: active ? tripView(active) : null, nextTrips: nextTrips.map(tripView),
    rating: { average: rating.average, count: rating.count },
    recentRatings: recentRatings.map((r) => ({ id: r._id, rating: r.rating, feedback: r.feedback, createdAt: r.createdAt })),
    notifications, unreadNotifications: unread,
  };
}

// Customers a driver serves through open recurring schedules.
async function assignedCustomerIds(driverProfileId) {
  const schedules = await Schedule.find({ driverId: driverProfileId, isOpen: true }).select("userId");
  return [...new Set(schedules.map((s) => String(s.userId)))];
}

module.exports = { adminDashboard, adminReport, customerDashboard, driverDashboard, assignedCustomerIds };
