const PricingConfig = require("../models/PricingConfig");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const fares = require("../services/fareService");
const routing = require("../services/routingService");
const geocoding = require("../services/geocodingService");
const { inrToPaise } = require("../utils/pricing");
const { HttpError, requireId, pickAllowed, wrap } = require("../utils/validate");

const publicCfg = (c) => c && ({ id: c._id, ratePerKmPaise: c.ratePerKmPaise, effectiveFrom: c.effectiveFrom, isActive: c.isActive, note: c.note, createdAt: c.createdAt });

const getActive = wrap(async (req, res) => {
  res.json({ success: true, config: publicCfg(await fares.activeConfig()) || null });
});

const list = wrap(async (req, res) => {
  const configs = await PricingConfig.find({}).sort({ effectiveFrom: -1, createdAt: -1 }).limit(100);
  const active = await fares.activeConfig();
  res.json({ success: true, activeId: active ? active._id : null, configs: configs.map(publicCfg) });
});

const create = wrap(async (req, res) => {
  pickAllowed(req.body, ["ratePerKm", "effectiveFrom", "note", "isActive"]);
  const b = req.body;
  let effectiveFrom = new Date();
  if (b.effectiveFrom !== undefined && b.effectiveFrom !== "") {
    effectiveFrom = new Date(b.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) throw new HttpError(400, "effectiveFrom must be a valid date");
  }
  if (b.note !== undefined && (typeof b.note !== "string" || b.note.length > 300)) throw new HttpError(400, "note must be text up to 300 characters");
  const ratePerKmPaise = inrToPaise(b.ratePerKm, "ratePerKm");
  if (ratePerKmPaise < 500 || ratePerKmPaise > 1000) throw new HttpError(400, "ratePerKm must be between ₹5 and ₹10 per kilometre");
  const cfg = await PricingConfig.create({
    ratePerKmPaise, effectiveFrom,
    isActive: b.isActive === undefined ? true : b.isActive === true, note: b.note || "", createdBy: req.user.id,
  });
  res.status(201).json({ success: true, message: "Pricing configuration saved. It applies to new requests only.", config: publicCfg(cfg) });
});

const setStatus = wrap(async (req, res) => {
  pickAllowed(req.body, ["isActive"]);
  requireId(req.params.id, "pricing ID");
  if (typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false");
  const cfg = await PricingConfig.findOneAndUpdate({ _id: req.params.id }, { $set: { isActive: req.body.isActive } }, { new: true });
  if (!cfg) throw new HttpError(404, "Pricing configuration not found");
  res.json({ success: true, config: publicCfg(cfg) });
});

// Preview only: nothing is stored. The amount is recomputed from scratch when the subscription is requested.
const quote = wrap(async (req, res) => {
  pickAllowed(req.body, ["planId", "directions", "serviceDays"]);
  requireId(req.body.planId, "plan ID");
  const plan = await SubscriptionPlan.findById(req.body.planId);
  if (!plan) throw new HttpError(404, "Subscription plan not found");
  const fare = await fares.quoteForUser(req.user.id, { directions: req.body.directions, serviceDays: req.body.serviceDays, durationMonths: plan.durationMonths });
  res.json({ success: true, fare, plan: { id: plan._id, name: plan.name, durationMonths: plan.durationMonths } });
});


const geocodeSearch = wrap(async (req, res) => {
  pickAllowed(req.body, ["query"]);
  const results = await geocoding.search(req.body.query);
  res.json({ success: true, results });
});

const geocodeReverse = wrap(async (req, res) => {
  pickAllowed(req.body, ["latitude", "longitude"]);
  const result = await geocoding.reverse(req.body.latitude, req.body.longitude);
  res.json({ success: true, result });
});

// Road route between two coordinates, for the map and for ETA. Same service the fare uses.
const hits = new Map();
const route = wrap(async (req, res) => {
  pickAllowed(req.body, ["from", "to"]);
  const now = Date.now();
  const mine = (hits.get(req.user.id) || []).filter((t) => now - t < 60000);
  if (mine.length >= 40) throw new HttpError(429, "Too many route requests. Wait a minute and try again.");
  mine.push(now); hits.set(req.user.id, mine);
  const r = await routing.getRoute(req.body.from, req.body.to);
  res.json({ success: true, route: r });
});

module.exports = { getActive, list, create, setStatus, quote, route, geocodeSearch, geocodeReverse };
