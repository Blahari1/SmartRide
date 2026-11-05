const Trip = require("../models/Trip");
const DriverProfile = require("../models/DriverProfile");
const realtime = require("../utils/realtime");
const { HttpError, requireId } = require("../utils/validate");

const DRIVER_PUBLIC = "fullName phone";

// Strict coordinate validation: real numbers only (no numeric strings), inside the valid ranges, and never the (0,0)
// "null island" default that broken GPS stacks report.
function validateCoordinates(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Location payload must be an object");
  const num = (k, min, max, { optional = false } = {}) => {
    const v = body[k];
    if (v === undefined || v === null) {
      if (optional) return null;
      throw new HttpError(400, `${k} is required`);
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new HttpError(400, `${k} must be a number between ${min} and ${max}`);
    return v;
  };
  const latitude = num("latitude", -90, 90);
  const longitude = num("longitude", -180, 180);
  if (latitude === 0 && longitude === 0) throw new HttpError(400, "Location (0, 0) is not a valid position");
  return {
    latitude, longitude,
    accuracy: num("accuracy", 0, 100000, { optional: true }),
    heading: num("heading", 0, 360, { optional: true }),
    speed: num("speed", 0, 100, { optional: true }),
  };
}

async function approvedDriver(userId) {
  const p = await DriverProfile.findOne({ userId });
  if (!p) throw new HttpError(404, "Complete your driver profile first");
  if (p.verificationStatus !== "approved") throw new HttpError(403, "Your account is not approved yet");
  return p;
}

// One function decides who may see/subscribe to a trip: the customer who owns it, the assigned approved driver, any admin.
// Everyone else gets a 404 so other trips are never revealed.
async function authorizeTrip(user, tripId) {
  requireId(tripId, "trip ID");
  const trip = await Trip.findById(tripId);
  if (!trip) throw new HttpError(404, "Trip not found");
  if (user.role === "admin") return { trip, driverProfile: null };
  if (user.role === "customer") {
    if (String(trip.userId) !== String(user.id)) throw new HttpError(404, "Trip not found");
    return { trip, driverProfile: null };
  }
  if (user.role === "driver") {
    const p = await approvedDriver(user.id);
    if (!trip.driverId || String(trip.driverId) !== String(p._id)) throw new HttpError(404, "Trip not found");
    return { trip, driverProfile: p };
  }
  throw new HttpError(403, "You do not have permission to access this resource");
}

const stateOf = (status) => (status === "in_progress" ? "active" : status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "not_started");
const shapeLocation = (l) => (l ? { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy ?? null, heading: l.heading ?? null, speed: l.speed ?? null, updatedAt: l.updatedAt } : null);

// Only the assigned driver, only while the trip is in progress. The conditional update is the check AND the write, so a
// trip that completed a millisecond ago cannot receive a late location.
async function updateLocation(driverUser, tripId, body) {
  requireId(tripId, "trip ID");
  const profile = await approvedDriver(driverUser.id);
  const clean = validateCoordinates(body);
  const at = new Date();
  const trip = await Trip.findOneAndUpdate(
    { _id: tripId, driverId: profile._id, status: "in_progress" },
    { $set: { lastLocation: { ...clean, updatedAt: at } } },
    { new: true },
  );
  if (!trip) {
    const t = await Trip.findById(tripId);
    if (!t || !t.driverId || String(t.driverId) !== String(profile._id)) throw new HttpError(404, "Trip not found");
    throw new HttpError(409, "Location can only be shared while the trip is in progress");
  }
  const loc = { ...clean, updatedAt: at.toISOString() };
  realtime.location(trip._id, loc);
  return loc;
}

// Role-scoped snapshot used by the REST endpoint and by the first message after a socket subscribes.
async function snapshot(user, tripId) {
  const { trip } = await authorizeTrip(user, tripId);
  await trip.populate({ path: "driverId", select: DRIVER_PUBLIC });
  const state = stateOf(trip.status);
  const contactVisible = user.role !== "customer" || ["confirmed", "in_progress", "completed"].includes(trip.status);
  return {
    tripId: trip._id, status: trip.status, state, date: trip.date, pickupTime: trip.pickupTime, dropTime: trip.dropTime,
    pickupLocation: trip.pickupLocation, dropLocation: trip.dropLocation, startedAt: trip.startedAt,
    driver: contactVisible && trip.driverId ? { name: trip.driverId.fullName, phone: trip.driverId.phone } : null,
    // Never expose a position outside an active trip.
    location: state === "active" ? shapeLocation(trip.lastLocation) : null,
  };
}

// Called when a trip completes or is cancelled: the position is deleted and viewers are disconnected from the room.
async function endTracking(trip, reason) {
  await Trip.updateOne({ _id: trip._id }, { $unset: { lastLocation: 1 } });
  realtime.endTracking(trip._id, reason);
}

async function listActive() {
  const trips = await Trip.find({ status: "in_progress" })
    .populate("userId", "name phone").populate("driverId", DRIVER_PUBLIC).sort({ startedAt: 1 });
  return trips.map((t) => ({
    tripId: t._id, date: t.date, servicePeriod: t.servicePeriod, pickupTime: t.pickupTime, status: t.status, startedAt: t.startedAt,
    customer: t.userId ? { name: t.userId.name, phone: t.userId.phone } : null,
    driver: t.driverId ? { name: t.driverId.fullName, phone: t.driverId.phone } : null,
    pickupLocation: t.pickupLocation, dropLocation: t.dropLocation,
    location: shapeLocation(t.lastLocation),
  }));
}

module.exports = { validateCoordinates, authorizeTrip, updateLocation, snapshot, endTracking, listActive, approvedDriver, stateOf };
