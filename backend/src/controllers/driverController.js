const DriverProfile = require("../models/DriverProfile");
const CustomerProfile = require("../models/CustomerProfile");
const Trip = require("../models/Trip");
const Subscription = require("../models/Subscription");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const Rating = require("../models/Rating");
const scheduling = require("../services/schedulingService");
const { addMonthsIst, todayIst, toIstDateStr } = require("../utils/time");
const reports = require("../services/reportService");
const { notify, notifyAdmins } = require("../services/notificationService");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const DOC_TYPES = ["driving_licence", "id_proof", "address_proof", "other"];
const PROFILE_FIELDS = ["fullName", "phone", "licenseNumber", "licenseValidUntil", "address", "documents"];
const LOCKED_WHEN_APPROVED = ["licenseNumber", "licenseValidUntil", "documents"];

function cleanProfile(body, { partial }) {
  pickAllowed(body, PROFILE_FIELDS);
  const out = {};
  const need = (k) => !partial && body[k] === undefined && (() => { throw new HttpError(400, `${k} is required`); })();
  ["fullName", "phone", "licenseNumber", "licenseValidUntil"].forEach(need);

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || body.fullName.trim().length < 2 || body.fullName.trim().length > 80) throw new HttpError(400, "fullName must contain 2 to 80 characters");
    out.fullName = body.fullName.trim();
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== "string" || !/^[0-9+\-\s]{7,20}$/.test(body.phone.trim())) throw new HttpError(400, "phone must be 7-20 digits");
    out.phone = body.phone.trim();
  }
  if (body.licenseNumber !== undefined) {
    if (typeof body.licenseNumber !== "string" || !/^[A-Za-z0-9\-\s]{5,30}$/.test(body.licenseNumber.trim())) throw new HttpError(400, "licenseNumber must be 5-30 letters/digits");
    out.licenseNumber = body.licenseNumber.trim().toUpperCase();
  }
  if (body.licenseValidUntil !== undefined) {
    const d = new Date(body.licenseValidUntil);
    if (typeof body.licenseValidUntil !== "string" || Number.isNaN(d.getTime())) throw new HttpError(400, "licenseValidUntil must be a valid date");
    if (d <= new Date()) throw new HttpError(400, "Driving licence has expired");
    out.licenseValidUntil = d;
  }
  if (body.address !== undefined) {
    if (typeof body.address !== "string" || body.address.trim().length > 300) throw new HttpError(400, "address must be at most 300 characters");
    out.address = body.address.trim();
  }
  if (body.documents !== undefined) {
    if (!Array.isArray(body.documents) || body.documents.length > 10) throw new HttpError(400, "documents must be an array of at most 10 items");
    out.documents = body.documents.map((d) => {
      if (!d || typeof d !== "object" || Array.isArray(d)) throw new HttpError(400, "Invalid document entry");
      pickAllowed(d, ["type", "reference"]);
      if (!DOC_TYPES.includes(d.type)) throw new HttpError(400, `document type must be one of ${DOC_TYPES.join(", ")}`);
      if (typeof d.reference !== "string" || !d.reference.trim() || d.reference.length > 500) throw new HttpError(400, "document reference is required (max 500 chars)");
      // Allow plain document numbers or https links only (no javascript:, data: etc.)
      if (/^[a-z][a-z0-9+.-]*:/i.test(d.reference.trim()) && !/^https:\/\//i.test(d.reference.trim())) throw new HttpError(400, "document reference links must use https");
      return { type: d.type, reference: d.reference.trim() };
    });
  }
  return out;
}

const createMine = wrap(async (req, res) => {
  const data = cleanProfile(req.body, { partial: false }); // validate first, then touch the DB
  if (!Array.isArray(data.documents) || !data.documents.some((d) => d.type === "driving_licence")) {
    throw new HttpError(400, "Add a driving licence document reference before submitting your profile");
  }
  if (await DriverProfile.exists({ userId: req.user.id })) throw new HttpError(409, "Driver profile already exists. Use PATCH /api/drivers/me");
  const profile = await DriverProfile.create({ ...data, userId: req.user.id }); // verification always starts as pending
  await notify(req.user.id, { type: "driver_submitted", category: "driver", title: "Verification submitted", message: "Your driver profile and documents were submitted. An administrator will review them.", related: { kind: "driver", id: profile._id } });
  await notifyAdmins({ type: "driver_verification_pending", category: "driver", title: "Driver awaiting verification", message: `${profile.fullName} submitted a driver profile for verification.`, related: { kind: "driver", id: profile._id } });
  res.status(201).json({ success: true, message: "Driver profile submitted for verification", profile });
});

const getMine = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) return res.json({ success: true, profile: null });
  res.json({ success: true, profile });
});

const updateMine = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) throw new HttpError(404, "Driver profile not found");
  const data = cleanProfile(req.body, { partial: true });
  if (!Object.keys(data).length) throw new HttpError(400, "Provide at least one field to update");
  if (profile.verificationStatus === "approved" && LOCKED_WHEN_APPROVED.some((k) => data[k] !== undefined)) {
    throw new HttpError(409, "Licence details and documents cannot be changed after approval. Contact an administrator.");
  }
  Object.assign(profile, data);
  const resubmitted = profile.verificationStatus === "rejected";
  if (resubmitted) {
    profile.verificationStatus = "pending"; // resubmission
    profile.rejectionReason = "";
  }
  await profile.save();
  if (resubmitted) await notifyAdmins({ type: "driver_verification_pending", category: "driver", title: "Driver resubmitted for verification", message: `${profile.fullName} updated a rejected profile and resubmitted it.`, related: { kind: "driver", id: profile._id } });
  res.json({ success: true, message: "Profile updated", profile });
});

const dashboard = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) return res.json({ success: true, profile: null });
  // Unapproved drivers can only view their own profile and verification status.
  if (profile.verificationStatus !== "approved") return res.json({ success: true, profile, approved: false });
  const [dashboardData, availableRequestsCount] = await Promise.all([
    reports.driverDashboard(profile),
    Subscription.countDocuments({ status: "pending", assignedDriverId: null }),
  ]);
  res.json({ success: true, approved: true, ...dashboardData, stats: { ...dashboardData.stats, availableRequests: availableRequestsCount } });
});

// Customers this driver serves through accepted recurring commute schedules.
const myCustomers = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) throw new HttpError(404, "Complete your driver profile first");
  if (profile.verificationStatus !== "approved") throw new HttpError(403, "Your account is not approved yet");
  const schedules = await Schedule.find({ driverId: profile._id, isOpen: true }).sort({ createdAt: -1 });
  const userIds = [...new Set(schedules.map((schedule) => String(schedule.userId)))];
  const [users, subscriptions] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name phone"),
    Subscription.find({ userId: { $in: userIds }, assignedDriverId: profile._id }).sort({ createdAt: -1 }),
  ]);
  const subByUser = new Map();
  subscriptions.forEach((sub) => { if (!subByUser.has(String(sub.userId))) subByUser.set(String(sub.userId), sub); });
  const customers = users.map((user) => {
    const schedule = schedules.find((item) => String(item.userId) === String(user._id));
    const sub = subByUser.get(String(user._id));
    return {
      id: user._id,
      name: user.name,
      phone: user.phone,
      subscription: sub ? { status: sub.status, plan: sub.planSnapshot.name, endDate: sub.endDate } : null,
      schedule: schedule ? {
        pickupTime: schedule.pickupTime, dropTime: schedule.dropTime,
        serviceDays: schedule.serviceDays, status: schedule.status,
        pickup: schedule.pickupLocation?.address, drop: schedule.dropLocation?.address,
      } : null,
    };
  });
  res.json({ success: true, count: customers.length, customers });
});

// A driver may switch their own availability (admin can too). Not while a trip is in progress.
const setMyAvailability = wrap(async (req, res) => {
  pickAllowed(req.body, ["availability"]);
  if (!["available", "unavailable"].includes(req.body.availability)) throw new HttpError(400, "availability must be available or unavailable");
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile) throw new HttpError(404, "Complete your driver profile first");
  if (profile.verificationStatus !== "approved") throw new HttpError(403, "Your account is not approved yet");
  if (req.body.availability === "unavailable" && (await Trip.exists({ driverId: profile._id, status: "in_progress" }))) throw new HttpError(409, "Finish your current trip first");
  profile.availability = req.body.availability;
  await profile.save();
  res.json({ success: true, profile });
});

const availableRequests = wrap(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile || profile.verificationStatus !== "approved" || profile.availability !== "available" || profile.licenseValidUntil <= new Date()) {
    throw new HttpError(403, "Only approved, available drivers with a valid licence can view requests");
  }
  const requests = await Subscription.find({ status: "pending", assignedDriverId: null })
    .populate("userId", "name phone").sort({ createdAt: 1 }).limit(100).lean();
  const profiles = await CustomerProfile.find({ userId: { $in: requests.map((s) => s.userId?._id).filter(Boolean) } })
    .select("userId pickupLocation dropLocation").lean();
  const profileByUser = new Map(profiles.map((p) => [String(p.userId), p]));
  res.json({ success: true, canAccept: true, requests: requests.map((s) => {
    const customerProfile = profileByUser.get(String(s.userId?._id));
    return {
      id: s._id,
      customer: s.userId ? { name: s.userId.name, phone: s.userId.phone } : null,
      plan: s.planSnapshot,
      fare: s.fareSnapshot,
      schedule: s.requestSchedule,
      pickupLocation: customerProfile?.pickupLocation || null,
      dropLocation: customerProfile?.dropLocation || null,
      createdAt: s.createdAt,
    };
  }) });
});

const acceptRequest = wrap(async (req, res) => {
  requireId(req.params.id, "subscription request ID");
  const now = new Date();
  const profile = await DriverProfile.findOne({ userId: req.user.id });
  if (!profile || profile.verificationStatus !== "approved" || profile.availability !== "available" || profile.licenseValidUntil <= now) {
    throw new HttpError(403, "Only approved, available drivers with a valid licence can accept requests");
  }
  const lockUntil = new Date(now.getTime() + 60_000);
  const locked = await DriverProfile.findOneAndUpdate(
    { _id: profile._id, verificationStatus: "approved", availability: "available", licenseValidUntil: { $gt: now },
      $or: [{ dispatchLockUntil: null }, { dispatchLockUntil: { $lt: now } }] },
    { $set: { dispatchLockUntil: lockUntil } }, { new: true },
  );
  if (!locked) throw new HttpError(409, "Another request is being accepted. Refresh and try again.");

  try {
    const request = await Subscription.findOneAndUpdate(
      { _id: req.params.id, status: "pending", assignedDriverId: null },
      { $set: { assignedDriverId: profile._id, acceptedAt: new Date(), status: "active" } },
      { new: true },
    );
    if (!request) throw new HttpError(409, "This request has already been accepted or is no longer available");

    try {
      const start = new Date();
      const end = addMonthsIst(start, request.planSnapshot.durationMonths);
      await Subscription.updateOne(
        { _id: request._id, assignedDriverId: profile._id, status: "active" },
        { $set: { startDate: start, endDate: end } },
      );

      const schedule = request.requestSchedule || {};
      const common = {
        subscriptionId: request._id, pickupTime: schedule.pickupTime, dropTime: schedule.dropTime,
        serviceDays: schedule.serviceDays, startDate: todayIst(),
        endDate: toIstDateStr(new Date(end.getTime() - 1)), driverId: profile._id,
      };
      const directions = Array.isArray(schedule.directions) ? schedule.directions : ["outbound"];
      if (directions.includes("outbound") && directions.includes("return")) {
        if (!schedule.returnPickupTime) throw new HttpError(400, "Return pickup time is missing from this two-way request");
        await scheduling.createCommute({ ...common, returnPickupTime: schedule.returnPickupTime, returnDropTime: schedule.returnDropTime }, req.user.id);
      } else {
        await scheduling.createSchedule({ ...common, direction: directions.includes("return") ? "return" : "outbound" }, req.user.id);
      }
    } catch (error) {
      await Subscription.updateOne(
        { _id: request._id, assignedDriverId: profile._id, status: "active" },
        { $set: { assignedDriverId: null, acceptedAt: null, status: "pending", startDate: null, endDate: null } },
      );
      throw error;
    }

    await Promise.allSettled([
      notify(request.userId, {
        type: "trip_assigned", category: "subscription", title: "Driver accepted your commute",
        message: `${profile.fullName} accepted your ${request.planSnapshot.name} commute request. Your recurring pickup schedule has been created.`,
        related: { kind: "subscription", id: request._id },
      }),
      notifyAdmins({
        type: "trip_assigned", category: "subscription", title: "Driver accepted a customer request",
        message: `${profile.fullName} accepted a customer subscription request.`,
        related: { kind: "subscription", id: request._id },
      }),
    ]);
    const populated = await Subscription.findById(request._id).populate("userId", "name phone").populate("assignedDriverId", "fullName phone");
    res.json({ success: true, message: "You accepted this commute request and the recurring schedule was created.", subscription: populated });
  } finally {
    await DriverProfile.updateOne({ _id: profile._id }, { $set: { dispatchLockUntil: null } });
  }
});

// ---------- admin ----------
async function listWith(req, res, forcedStatus) {
  const filter = {};
  const status = forcedStatus || req.query.status;
  if (status !== undefined) {
    if (!["pending", "approved", "rejected"].includes(status)) throw new HttpError(400, "Invalid status filter");
    filter.verificationStatus = status;
  }
  const drivers = await DriverProfile.find(filter).populate("userId", "name email phone isActive createdAt").sort({ createdAt: -1 }).limit(200).lean();
  const registeredUsers = status === "approved" || status === "rejected"
    ? []
    : await User.find({
      role: "driver",
      _id: { $nin: (await DriverProfile.find({}).select("userId").lean()).map((p) => p.userId) },
    }).select("name email phone isActive createdAt").sort({ createdAt: -1 }).limit(200).lean();
  const unsubmittedDrivers = registeredUsers.map((u) => ({
    id: u._id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive,
    createdAt: u.createdAt, verificationStatus: "profile_incomplete",
  }));
  const ratingRows = await Rating.aggregate([{ $match: { driverId: { $in: drivers.map((d) => d._id) } } }, { $group: { _id: "$driverId", total: { $sum: "$rating" }, count: { $sum: 1 } } }]);
  const ratingBy = new Map(ratingRows.map((r) => [r._id.toString(), { count: r.count, average: Math.round((r.total / r.count) * 100) / 100 }]));
  res.json({
    success: true,
    count: drivers.length,
    drivers: drivers.map((d) => ({ ...d, rating: ratingBy.get(d._id.toString()) || { count: 0, average: null } })),
    unsubmittedDrivers,
  });
}
const list = wrap((req, res) => listWith(req, res));
const listPending = wrap((req, res) => listWith(req, res, "pending"));

const getOne = wrap(async (req, res) => {
  requireId(req.params.id, "driver ID");
  const d = await DriverProfile.findById(req.params.id).populate("userId", "name email phone isActive");
  if (!d) throw new HttpError(404, "Driver not found");
  res.json({ success: true, driver: d });
});

const verify = wrap(async (req, res) => {
  pickAllowed(req.body, ["status", "reason"]);
  requireId(req.params.id, "driver ID");
  const { status, reason } = req.body;
  if (!["approved", "rejected"].includes(status)) throw new HttpError(400, "status must be approved or rejected");
  if (status === "rejected" && (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 300)) {
    throw new HttpError(400, "A rejection reason (3-300 chars) is required");
  }
  const d = await DriverProfile.findById(req.params.id);
  if (!d) throw new HttpError(404, "Driver not found");
  if (status === "approved" && d.licenseValidUntil <= new Date()) throw new HttpError(409, "Cannot approve: driving licence has expired");
  if (status === "approved" && !d.documents?.some((doc) => doc.type === "driving_licence" && doc.reference?.trim())) {
    throw new HttpError(409, "Cannot approve: a driving licence document reference is required");
  }
  const driverUser = await User.findById(d.userId).select("isActive");
  if (status === "approved" && (!driverUser || !driverUser.isActive)) throw new HttpError(409, "Cannot approve an inactive driver account");
  if (d.userId.toString() === req.user.id) throw new HttpError(403, "You cannot verify your own account");

  if (status === "rejected") {
    const openTrips = await Trip.countDocuments({ driverId: d._id, isOpen: true });
    if (openTrips) throw new HttpError(409, "Driver has open trips; reassign them before rejecting");
  }
  d.verificationStatus = status;
  d.rejectionReason = status === "rejected" ? reason.trim() : "";
  d.verifiedBy = req.user.id;
  d.verifiedAt = new Date();
  await d.save();
  await notify(d.userId, status === "approved"
    ? { type: "driver_approved", category: "driver", title: "Verification approved", message: "Your driver account is approved. You can now view and accept commute requests.", related: { kind: "driver", id: d._id } }
    : { type: "driver_rejected", category: "driver", title: "Verification rejected", message: `Your driver verification was rejected: ${d.rejectionReason}. Update your details to resubmit.`, related: { kind: "driver", id: d._id } });
  res.json({ success: true, message: `Driver ${status}`, driver: d });
});

const setAvailability = wrap(async (req, res) => {
  pickAllowed(req.body, ["availability"]);
  requireId(req.params.id, "driver ID");
  if (!["available", "unavailable"].includes(req.body.availability)) throw new HttpError(400, "availability must be available or unavailable");
  const d = await DriverProfile.findByIdAndUpdate(req.params.id, { $set: { availability: req.body.availability } }, { new: true });
  if (!d) throw new HttpError(404, "Driver not found");
  res.json({ success: true, driver: d });
});

module.exports = { createMine, getMine, updateMine, dashboard, myCustomers, setMyAvailability, availableRequests, acceptRequest, list, listPending, getOne, verify, setAvailability };
