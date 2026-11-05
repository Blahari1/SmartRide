const Subscription = require("../models/Subscription");
const DriverProfile = require("../models/DriverProfile");
const subs = require("../services/subscriptionService");
const scheduling = require("../services/schedulingService");
const { notify, notifyAdmins } = require("../services/notificationService");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const STATUSES = ["pending", "active", "cancelled", "expired"];

const create = wrap(async (req, res) => {
  pickAllowed(req.body, ["planId", "directions", "serviceDays", "pickupTime", "dropTime", "returnPickupTime", "returnDropTime"]); // amounts and distances are calculated server-side
  requireId(req.body.planId, "plan ID");
  const subscription = await subs.createRequest(req.user.id, req.body.planId, {
    commute: { directions: req.body.directions, serviceDays: req.body.serviceDays },
    schedule: {
      pickupTime: req.body.pickupTime,
      dropTime: req.body.dropTime,
      returnPickupTime: req.body.returnPickupTime,
      returnDropTime: req.body.returnDropTime,
    },
  });
  const eligibleDrivers = await DriverProfile.find({
    verificationStatus: "approved",
    availability: "available",
    licenseValidUntil: { $gt: new Date() },
  }).select("userId");
  await Promise.allSettled(eligibleDrivers.map((driver) => notify(driver.userId, {
    type: "subscription_request",
    category: "subscription",
    title: "New commute request available",
    message: "A customer has requested a recurring commute. Open Available Requests to review the route, days and times.",
    related: { kind: "subscription", id: subscription._id },
  })));
  await Promise.allSettled([notifyAdmins({
    type: "subscription_request",
    category: "subscription",
    title: "New customer commute request",
    message: "A new subscription request is waiting for an approved driver to accept it.",
    related: { kind: "subscription", id: subscription._id },
  })]);
  res.status(201).json({
    success: true,
    message: `Your ride request has been shared with ${eligibleDrivers.length} approved, available driver(s).`,
    subscription,
    notifiedDrivers: eligibleDrivers.length,
  });
});

const mine = wrap(async (req, res) => {
  await subs.expireDue({ userId: req.user.id });
  const history = await Subscription.find({ userId: req.user.id }).sort({ createdAt: -1 });
  const current = history.find((s) => s.status === "active") || history.find((s) => s.status === "pending") || null;
  await Promise.all(history.map((h) => h.populate({ path: "assignedDriverId", select: "fullName phone" })));
  res.json({ success: true, current: current ? history.find((h) => String(h._id) === String(current._id)) : null, subscriptions: history });
});

async function loadOwned(req) {
  requireId(req.params.id, "subscription ID");
  await subs.expireDue({ _id: req.params.id });
  const sub = await Subscription.findById(req.params.id).populate("userId", "name email phone").populate("assignedDriverId", "fullName phone");
  // Do not reveal existence of other customers' subscriptions.
  if (!sub || (req.user.role !== "admin" && sub.userId._id.toString() !== req.user.id)) {
    throw new HttpError(404, "Subscription not found");
  }
  return sub;
}

const getOne = wrap(async (req, res) => {
  const subscription = await loadOwned(req);
  await subscription.populate({ path: "assignedDriverId", select: "fullName phone" });
  res.json({ success: true, subscription });
});

const cancelOne = wrap(async (req, res) => {
  const sub = await loadOwned(req);
  await subs.cancel(sub);
  // Cancelling a subscription closes its schedule and future trips.
  await scheduling.cancelForSubscription(sub._id, "Subscription cancelled");
  await notify(sub.userId._id || sub.userId, { type: "subscription_cancelled", category: "subscription", title: "Subscription cancelled", message: `Your ${sub.planSnapshot.name} subscription was cancelled.`, related: { kind: "subscription", id: sub._id } });
  res.json({ success: true, message: "Subscription cancelled", subscription: sub });
});

const listAll = wrap(async (req, res) => {
  await subs.expireDue();
  const { status } = req.query;
  const filter = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (req.query.userId !== undefined) filter.userId = requireId(req.query.userId, "user ID");
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const [items, total] = await Promise.all([
    Subscription.find(filter).populate("userId", "name email phone").populate("assignedDriverId", "fullName phone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Subscription.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, subscriptions: items });
});

module.exports = { create, mine, getOne, cancelOne, listAll };
