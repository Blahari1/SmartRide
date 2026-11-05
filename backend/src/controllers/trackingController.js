const tracking = require("../services/trackingService");
const { pickAllowed, requireId, wrap } = require("../utils/validate");

const postLocation = wrap(async (req, res) => {
  pickAllowed(req.body, ["latitude", "longitude", "accuracy", "heading", "speed"]);
  const location = await tracking.updateLocation(req.user, req.params.tripId, req.body);
  res.json({ success: true, location });
});
const getTrip = wrap(async (req, res) => {
  requireId(req.params.tripId, "trip ID");
  res.json({ success: true, tracking: await tracking.snapshot(req.user, req.params.tripId) });
});
const active = wrap(async (req, res) => {
  const trips = await tracking.listActive();
  res.json({ success: true, count: trips.length, trips });
});

module.exports = { postLocation, getTrip, active };
