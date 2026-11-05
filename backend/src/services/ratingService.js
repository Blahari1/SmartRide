const Rating = require("../models/Rating");
const Trip = require("../models/Trip");
const DriverProfile = require("../models/DriverProfile");
const { notify } = require("./notificationService");
const { HttpError, requireId } = require("../utils/validate");

function validateRating({ rating, feedback }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "rating must be a whole number from 1 to 5");
  if (feedback !== undefined && feedback !== null && typeof feedback !== "string") throw new HttpError(400, "feedback must be text");
  const text = (feedback || "").trim();
  if (text.length > 500) throw new HttpError(400, "feedback must be at most 500 characters");
  return { rating, feedback: text };
}

// Only the customer who owns a COMPLETED trip can rate it, once. Ownership, driver and status all come from the stored trip.
async function submit(customerUser, { tripId, rating, feedback }) {
  requireId(tripId, "trip ID");
  const clean = validateRating({ rating, feedback });
  const trip = await Trip.findById(tripId);
  if (!trip || String(trip.userId) !== String(customerUser.id)) throw new HttpError(404, "Trip not found");
  if (trip.status !== "completed") throw new HttpError(409, "Only completed trips can be rated");
  if (!trip.driverId) throw new HttpError(409, "This trip has no driver to rate");
  if (await Rating.exists({ tripId: trip._id })) throw new HttpError(409, "You have already rated this trip");
  let doc;
  try {
    doc = await Rating.create({ tripId: trip._id, userId: customerUser.id, driverId: trip.driverId, ...clean });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, "You have already rated this trip"); // unique index is the race-safe guard
    throw e;
  }
  const driver = await DriverProfile.findById(trip.driverId);
  if (driver) {
    await notify(driver.userId, {
      type: "rating_received", category: "rating", title: "New rating received",
      message: `A customer rated a trip on ${trip.date} ${clean.rating} out of 5${clean.feedback ? " and left feedback" : ""}.`,
      related: { kind: "rating", id: doc._id },
    });
  }
  return doc;
}

// Average, count and 1-5 distribution derived from a grouped count (one group per star value).
async function summaryFor(match = {}) {
  const groups = await Rating.aggregate([{ $match: match }, { $group: { _id: "$rating", n: { $sum: 1 } } }]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  groups.forEach((g) => { distribution[g._id] = g.n; });
  const count = Object.values(distribution).reduce((a, b) => a + b, 0);
  const total = Object.entries(distribution).reduce((a, [star, n]) => a + Number(star) * n, 0);
  return { count, average: count ? Math.round((total / count) * 100) / 100 : null, distribution };
}

module.exports = { validateRating, submit, summaryFor };
