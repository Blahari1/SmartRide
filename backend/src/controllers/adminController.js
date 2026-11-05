const User = require("../models/User");
const CustomerProfile = require("../models/CustomerProfile");
const Subscription = require("../models/Subscription");
const Trip = require("../models/Trip");
const reports = require("../services/reportService");
const subs = require("../services/subscriptionService");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const dashboard = wrap(async (req, res) => {
  res.json({ success: true, ...(await reports.adminDashboard()) });
});

const report = wrap(async (req, res) => {
  res.json({ success: true, report: await reports.adminReport({ from: req.query.from, to: req.query.to }) });
});

// ---------- customers ----------
const listCustomers = wrap(async (req, res) => {
  const f = { role: "customer" };
  if (req.query.active !== undefined) {
    if (!["true", "false"].includes(req.query.active)) throw new HttpError(400, "active must be true or false");
    f.isActive = req.query.active === "true";
  }
  if (req.query.q) {
    const re = new RegExp(escapeRe(String(req.query.q).slice(0, 60)), "i");
    f.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  const sortKey = { name: "name", email: "email", createdAt: "createdAt" }[req.query.sort] || "createdAt";
  const dir = req.query.dir === "asc" ? 1 : -1;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [users, total] = await Promise.all([
    User.find(f).select("name email phone isActive createdAt").sort({ [sortKey]: dir }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(f),
  ]);
  await subs.expireOnly({ userId: { $in: users.map((u) => u._id) } });
  const open = await Subscription.find({ userId: { $in: users.map((u) => u._id) }, status: { $in: ["active", "pending"] } }).select("userId status planSnapshot endDate");
  const bySub = new Map();
  open.forEach((s) => { const k = String(s.userId); if (!bySub.has(k) || s.status === "active") bySub.set(k, s); });
  res.json({
    success: true, total, page, limit,
    customers: users.map((u) => {
      const s = bySub.get(String(u._id));
      return { id: u._id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive, createdAt: u.createdAt, subscription: s ? { status: s.status, plan: s.planSnapshot.name, endDate: s.endDate } : null };
    }),
  });
});

const getCustomer = wrap(async (req, res) => {
  requireId(req.params.id, "customer ID");
  const user = await User.findOne({ _id: req.params.id, role: "customer" }).select("name email phone isActive createdAt");
  if (!user) throw new HttpError(404, "Customer not found");
  await subs.expireDue({ userId: user._id });
  const [profile, subscriptions, tripGroups, recentTrips] = await Promise.all([
    CustomerProfile.findOne({ userId: user._id }),
    Subscription.find({ userId: user._id }).populate("assignedDriverId", "fullName phone").sort({ createdAt: -1 }),
    Trip.aggregate([{ $match: { userId: user._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Trip.find({ userId: user._id }).populate("driverId", "fullName").sort({ date: -1 }).limit(10),
  ]);
  const trips = { scheduled: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0 };
  tripGroups.forEach((g) => { trips[g._id] = g.n; });
  res.json({ success: true, customer: user, profile, subscriptions, tripCounts: trips, recentTrips });
});

const setCustomerStatus = wrap(async (req, res) => {
  pickAllowed(req.body, ["isActive"]);
  requireId(req.params.id, "customer ID");
  if (typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false");
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: "customer" }, { $set: { isActive: req.body.isActive } }, { new: true }).select("name email phone isActive");
  if (!user) throw new HttpError(404, "Customer not found");
  res.json({ success: true, message: user.isActive ? "Customer account enabled" : "Customer account disabled", customer: user });
});

module.exports = { dashboard, report, listCustomers, getCustomer, setCustomerStatus };
