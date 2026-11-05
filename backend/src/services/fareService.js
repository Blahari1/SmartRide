// Server-side quote: customer's SAVED locations -> OSRM road distance per direction -> active pricing configuration.
// Nothing in a request body (distance, rate, amount) is trusted.
const PricingConfig = require("../models/PricingConfig");
const CustomerProfile = require("../models/CustomerProfile");
const routing = require("./routingService");
const pricing = require("../utils/pricing");
const { HttpError } = require("../utils/validate");

async function activeConfig() {
  return PricingConfig.findOne({ isActive: true, effectiveFrom: { $lte: new Date() } }).sort({ effectiveFrom: -1, createdAt: -1 });
}

const loc = (l) => ({ address: l.address, latitude: l.latitude, longitude: l.longitude });
const hasCoords = (l) => l && l.address && l.address.trim() && typeof l.latitude === "number" && typeof l.longitude === "number";

async function quoteForUser(userId, { directions, serviceDays, durationMonths }) {
  pricing.validateCommute({ directions, serviceDays });
  const cfg = await activeConfig();
  if (!cfg) throw new HttpError(409, "No active pricing configuration exists. Ask an administrator to configure pricing.");
  const profile = await CustomerProfile.findOne({ userId });
  if (!profile || !hasCoords(profile.pickupLocation) || !hasCoords(profile.dropLocation)) {
    throw new HttpError(409, "Save your Home and College/Office locations (with map coordinates) before requesting a fare.");
  }
  const home = profile.pickupLocation, college = profile.dropLocation; // Home = pickup, College/Office = drop
  const legs = [];
  for (const direction of directions) {
    const [from, to] = direction === "return" ? [college, home] : [home, college];
    const r = await routing.getRoute(from, to); // each direction is routed separately (one-way streets can differ)
    legs.push({ direction, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, from: loc(from), to: loc(to) });
  }
  return pricing.buildFare(cfg, { directions, serviceDays, durationMonths }, legs);
}

module.exports = { activeConfig, quoteForUser };
