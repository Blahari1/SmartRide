const Subscription = require("../models/Subscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const { HttpError } = require("../utils/validate");
const fares = require("./fareService");

// Expired subscriptions must never be treated as active: flip them lazily before any read/decision.
async function expireOnly(filter = {}) {
  await Subscription.updateMany({ ...filter, status: "active", endDate: { $lte: new Date() } }, { $set: { status: "expired" } });
}

async function expireDue(filter = {}) {
  await expireOnly(filter);
}

async function createRequest(userId, planId, { commute = null, schedule = null } = {}) {
  await expireDue({ userId });
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw new HttpError(404, "Subscription plan not found");
  if (!plan.isActive) throw new HttpError(409, "This plan is not available for new subscriptions");

  const pending = await Subscription.findOne({ userId, status: "pending" });
  if (pending) throw new HttpError(409, "You already have a pending subscription request");

  const active = await Subscription.findOne({ userId, status: "active" });
  if (active) throw new HttpError(409, "You already have an active subscription");

  // Every new request must use server-calculated road-distance pricing. Legacy fixed plan prices
  // remain stored only for historical subscriptions; they are never used to price a new request.
  const config = await fares.activeConfig();
  if (!config) throw new HttpError(409, "Distance-based pricing is not configured yet. Please try again after an administrator configures pricing.");
  if (!commute || !commute.directions || !commute.serviceDays) {
    throw new HttpError(400, "Choose your journey direction(s) and service days to get a fare");
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!schedule || !timePattern.test(schedule.pickupTime || "") || !timePattern.test(schedule.dropTime || "")) {
    throw new HttpError(400, "Enter valid pickup and drop times");
  }
  if (commute.directions.includes("outbound") && commute.directions.includes("return") && !timePattern.test(schedule.returnPickupTime || "")) {
    throw new HttpError(400, "Enter a return pickup time for a two-way commute");
  }
  const fare = await fares.quoteForUser(userId, {
    directions: commute.directions,
    serviceDays: commute.serviceDays,
    durationMonths: plan.durationMonths,
  });

  try {
    return await Subscription.create({
      userId,
      planId: plan._id,
      planSnapshot: {
        name: plan.name,
        durationMonths: plan.durationMonths,
        pricePaise: fare.totalPaise,
        description: plan.description,
      },
      fareSnapshot: fare || undefined,
      requestSchedule: {
        pickupTime: schedule.pickupTime,
        dropTime: schedule.dropTime,
        returnPickupTime: schedule.returnPickupTime || null,
        returnDropTime: schedule.returnDropTime || null,
        serviceDays: commute.serviceDays,
        directions: commute.directions,
      },
      status: "pending",
    });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, "A conflicting subscription already exists");
    throw e;
  }
}

async function cancel(subscription) {
  if (!["pending", "active"].includes(subscription.status)) {
    throw new HttpError(409, `A ${subscription.status} subscription cannot be cancelled`);
  }
  subscription.status = "cancelled";
  subscription.cancelledAt = new Date();
  await subscription.save();
  return subscription;
}

module.exports = { expireOnly, expireDue, createRequest, cancel };
