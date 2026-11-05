// Offline tests for distance-based pricing, routing and fare snapshots. OSRM is STUBBED (no network in the test run), so these
// prove the fare logic and guards, NOT the real OSRM response. See docs/SUBMISSION_GUIDE.md for the live checks.
process.env.JWT_SECRET = "t".repeat(48);
process.env.NODE_ENV = "test";
const assert = require("assert");
const env = require("./helpers/fakeEnv");
const { models: M, resetAll, runRoute } = env;
const pricing = require("../src/utils/pricing");
const routing = require("../src/services/routingService");
const geocoding = require("../src/services/geocodingService");
const fares = require("../src/services/fareService");
const subs = require("../src/services/subscriptionService");
const scheduling = require("../src/services/schedulingService");
const pricingRoutes = require("../src/routes/pricingRoutes");
const T = require("../src/utils/time");

const FUTURE = new Date(Date.now() + 400 * 86400000);
let passed = 0, failed = 0;
const t = async (name, fn) => {
  resetAll(); routing._clearCache();
  try { await fn(); passed++; console.log("  ok   ", name); } catch (e) { failed++; console.log("  FAIL ", name, "\n        ", e.stack.split("\n").slice(0, 4).join("\n         ")); }
};
const rejects = async (p, status, re) => {
  try { await p; } catch (e) { assert.strictEqual(e.status, status, `expected ${status}, got ${e.status}: ${e.message}`); if (re) assert.match(e.message, re); return; }
  assert.fail(`expected HttpError ${status}`);
};

// Stub: outbound 12.3 km, return 13.1 km (routes differ per direction). Calls are counted.
let calls = 0;
const osrm = (m) => async (url) => {
  calls++;
  const [a] = url.split("/driving/")[1].split("?")[0].split(";");
  const km = m && m.fail ? null : (a.startsWith("77.59") ? 12.34 : 13.06); // from Home vs from College
  if (m && m.fail === "noroute") return { ok: true, json: async () => ({ code: "NoRoute" }) };
  if (m && m.fail === "down") throw new Error("ECONNREFUSED");
  return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: km * 1000, duration: 1500, geometry: { coordinates: [[77.59, 12.97], [77.57, 12.99], [77.55, 13.01]] } }] }) };
};
const HOME = { address: "12 Home Street", landmark: "", latitude: 12.97, longitude: 77.59 };
const COLLEGE = { address: "ABC College", landmark: "", latitude: 13.01, longitude: 77.55 };
const CFG = { ratePerKmPaise: 700 };

async function customer(withLocs = true) {
  const u = await M.User.create({ name: "Cust", email: "c@x.io", role: "customer" });
  if (withLocs) await M.CustomerProfile.create({ userId: u._id, pickupLocation: HOME, dropLocation: COLLEGE });
  return u;
}
async function plan(months = 1) { return M.SubscriptionPlan.create({ name: `P${months}`, durationMonths: months, pricePaise: 150000, description: "", isActive: true }); }

(async () => {
  console.log("Fare maths (pure)");
  await t("trip fare = actual road kilometres × ₹7/km, integer paise", async () => {
    assert.strictEqual(pricing.tripFarePaise(CFG, 12300), 8610);
    assert.strictEqual(pricing.tripFarePaise(CFG, 13100), 9170);
    assert.strictEqual(pricing.tripFarePaise({ ...CFG, ratePerKmPaise: 1000 }, 1000), 1000);
    assert.ok(Number.isInteger(pricing.tripFarePaise({ ...CFG, ratePerKmPaise: 550 }, 7777)));
  });
  await t("journey days per month = round(days/week * 52/12)", async () => {
    assert.strictEqual(pricing.journeyDaysPerMonth(5), 22);
    assert.strictEqual(pricing.journeyDaysPerMonth(6), 26);
    assert.strictEqual(pricing.journeyDaysPerMonth(1), 4);
  });
  await t("one-way vs two-way: only selected directions are charged; legs priced separately", async () => {
    const legs = [{ direction: "outbound", distanceMeters: 12300 }, { direction: "return", distanceMeters: 13100 }];
    const input = { serviceDays: [1, 2, 3, 4, 5], durationMonths: 1 };
    const one = pricing.buildFare(CFG, { ...input, directions: ["outbound"] }, legs);
    assert.strictEqual(one.legs.length, 1);
    assert.strictEqual(one.perServiceDayPaise, 8610);
    assert.strictEqual(one.totalPaise, 8610 * 22);
    const two = pricing.buildFare(CFG, { ...input, directions: ["outbound", "return"] }, legs);
    assert.strictEqual(two.legs[1].farePaise, 9170);
    assert.strictEqual(two.perServiceDayPaise, 8610 + 9170);
    assert.strictEqual(two.totalPaise, (8610 + 9170) * 22);
    const quarter = pricing.buildFare(CFG, { ...input, directions: ["outbound", "return"], durationMonths: 3 }, legs);
    assert.strictEqual(quarter.totalPaise, two.totalPaise * 3);
  });
  await t("input validation (directions, days, INR to paise)", async () => {
    assert.throws(() => pricing.validateCommute({ directions: [], serviceDays: [1] }), (e) => e.status === 400);
    assert.throws(() => pricing.validateCommute({ directions: ["sideways"], serviceDays: [1] }), (e) => e.status === 400);
    assert.throws(() => pricing.validateCommute({ directions: ["outbound"], serviceDays: [1, 1] }), (e) => e.status === 400);
    assert.throws(() => pricing.validateCommute({ directions: ["outbound"], serviceDays: [7] }), (e) => e.status === 400);
    assert.strictEqual(pricing.inrToPaise(12.5, "x"), 1250);
    assert.strictEqual(pricing.inrToPaise("0.1", "x"), 10);
    for (const bad of [-1, "abc", NaN, 1.234, Infinity, null]) assert.throws(() => pricing.inrToPaise(bad, "x"), (e) => e.status === 400, String(bad));
  });

  console.log("Routing (OSRM stubbed)");
  await t("returns road distance, ETA and a Leaflet-ordered polyline; repeated identical request is cached", async () => {
    routing._setFetch(osrm()); calls = 0;
    const r = await routing.getRoute(HOME, COLLEGE);
    assert.strictEqual(r.distanceKm, 12.3); assert.strictEqual(r.durationMinutes, 25);
    assert.deepStrictEqual(r.geometry[0], [12.97, 77.59]);
    await routing.getRoute(HOME, COLLEGE);
    assert.strictEqual(calls, 1, "second call must come from the cache");
  });
  await t("NO straight-line fallback: unreachable service / no route / same place / bad coords are errors", async () => {
    routing._setFetch(osrm({ fail: "down" })); await rejects(routing.getRoute(HOME, COLLEGE), 502);
    routing._clearCache(); routing._setFetch(osrm({ fail: "noroute" })); await rejects(routing.getRoute(HOME, COLLEGE), 422, /No road route/);
    routing._setFetch(osrm()); await rejects(routing.getRoute(HOME, { ...HOME }), 400, /same place/);
    await rejects(routing.getRoute(HOME, { latitude: "x", longitude: 1 }), 400);
    await rejects(routing.getRoute(HOME, { latitude: 0, longitude: 0 }), 400);
  });

  console.log("Server-side quote and subscription snapshot");
  await t("quote uses SAVED locations and the active config; each direction routed separately", async () => {
    routing._setFetch(osrm()); calls = 0;
    const u = await customer(); await M.PricingConfig.create(CFG);
    const q = await fares.quoteForUser(String(u._id), { directions: ["outbound", "return"], serviceDays: [1, 2, 3, 4, 5], durationMonths: 1 });
    assert.strictEqual(calls, 2);
    assert.strictEqual(q.legs[0].from.address, HOME.address); assert.strictEqual(q.legs[1].from.address, COLLEGE.address);
    assert.strictEqual(q.legs[0].distanceMeters, 12340); assert.strictEqual(q.legs[1].distanceMeters, 13060);
  });
  await t("no active configuration, missing coordinates, or routing failure => no quote", async () => {
    routing._setFetch(osrm());
    const u = await customer();
    await rejects(fares.quoteForUser(String(u._id), { directions: ["outbound"], serviceDays: [1], durationMonths: 1 }), 409, /pricing configuration/);
    await M.PricingConfig.create(CFG);
    await M.CustomerProfile.create({ userId: String(env.oid()), pickupLocation: { address: "x" }, dropLocation: { address: "y" } });
    const u2 = await M.User.create({ name: "B", email: "b@x.io", role: "customer" });
    await M.CustomerProfile.create({ userId: u2._id, pickupLocation: { address: "No coords" }, dropLocation: COLLEGE });
    await rejects(fares.quoteForUser(String(u2._id), { directions: ["outbound"], serviceDays: [1], durationMonths: 1 }), 409, /coordinates/);
    routing._setFetch(osrm({ fail: "down" }));
    await rejects(fares.quoteForUser(String(u._id), { directions: ["outbound"], serviceDays: [1], durationMonths: 1 }), 502);
  });
  await t("subscription stores the snapshot; planSnapshot.pricePaise = server fare, not the plan's fixed price", async () => {
    routing._setFetch(osrm());
    const u = await customer(); await M.PricingConfig.create(CFG); const p = await plan(1);
    const s = await subs.createRequest(String(u._id), String(p._id), { commute: { directions: ["outbound", "return"], serviceDays: [1, 2, 3, 4, 5] }, schedule: { pickupTime: "08:00", dropTime: "08:45", returnPickupTime: "17:00", returnDropTime: "17:45" } });
    assert.strictEqual(s.fareSnapshot.mode, "distance");
    assert.strictEqual(s.planSnapshot.pricePaise, s.fareSnapshot.totalPaise);
    assert.notStrictEqual(s.planSnapshot.pricePaise, 150000);
    assert.deepStrictEqual(s.fareSnapshot.directions, ["outbound", "return"]);
  });
  await t("changing pricing later does not change an existing request's fare", async () => {
    routing._setFetch(osrm());
    const u = await customer(); const old = await M.PricingConfig.create({ ...CFG, effectiveFrom: new Date(Date.now() - 86400000) }); const p = await plan(1);
    const s = await subs.createRequest(String(u._id), String(p._id), { commute: { directions: ["outbound"], serviceDays: [1, 2, 3, 4, 5] }, schedule: { pickupTime: "08:00", dropTime: "08:45" } });
    const before = s.planSnapshot.pricePaise;
    await M.PricingConfig.create({ ...CFG, ratePerKmPaise: 950, effectiveFrom: new Date() });
    assert.strictEqual(s.planSnapshot.pricePaise, before);
    assert.strictEqual(s.fareSnapshot.pricing.ratePerKmPaise, 700, "snapshot keeps the rate it was priced with");
    assert.strictEqual((await fares.activeConfig()).ratePerKmPaise, 950, "new requests use the new config");
    assert.ok(old);
  });
  await t("new requests require active distance pricing; no legacy fixed-price fallback", async () => {
    routing._setFetch(osrm());
    const u = await customer(); const p = await plan(1);
    await rejects(
      subs.createRequest(String(u._id), String(p._id), { commute: {} }),
      409,
      /Distance-based pricing is not configured/,
    );
    resetAll(); const u2 = await customer(); const p2 = await plan(1); await M.PricingConfig.create(CFG);
    await rejects(subs.createRequest(String(u2._id), String(p2._id), { commute: {} }), 400, /direction/);
  });
  await t("a one-way subscription cannot get a return schedule (that direction was not requested)", async () => {
    routing._setFetch(osrm());
    const u = await customer(); await M.PricingConfig.create(CFG); const p = await plan(1);
    const s = await subs.createRequest(String(u._id), String(p._id), { commute: { directions: ["outbound"], serviceDays: [1, 2, 3, 4, 5] }, schedule: { pickupTime: "08:00", dropTime: "08:45" } });
    s.status = "active"; s.startDate = new Date(Date.now() - 86400000); s.endDate = new Date(Date.now() + 40 * 86400000);
    const today = T.todayIst();
    const base = { subscriptionId: String(s._id), startDate: today, endDate: T.addDaysStr(today, 6), pickupTime: "17:00", dropTime: "18:00" };
    await rejects(scheduling.createSchedule({ ...base, serviceDays: [1, 2], direction: "return" }, "a".repeat(24)), 409, /not requested/);
    await rejects(scheduling.createSchedule({ ...base, serviceDays: [6], direction: "outbound", pickupTime: "08:00", dropTime: "09:00" }, "a".repeat(24)), 409, /weekdays/);
  });

  console.log("Pricing routes: permissions");
  await t("only admin writes pricing; customers get route fare quotes", async () => {
    const allowed = (method, path) => pricingRoutes.routes.find((r) => r.method === method && r.path === path);
    const check = async (route, role, expectOk) => {
      const guard = route.handlers[0]; let status = null, nexted = false;
      await guard({ user: { role } }, { status(c) { status = c; return this; }, json() { return this; } }, () => { nexted = true; });
      assert.strictEqual(nexted, expectOk, `${route.method} ${route.path} as ${role}`);
      if (!expectOk) assert.strictEqual(status, 403);
    };
    for (const role of ["customer", "driver"]) { await check(allowed("POST", "/"), role, false); await check(allowed("PATCH", "/:id/status"), role, false); await check(allowed("GET", "/"), role, false); }
    await check(allowed("POST", "/"), "admin", true); await check(allowed("POST", "/quote"), "customer", true); await check(allowed("POST", "/quote"), "admin", false);
    await check(allowed("GET", "/active"), "driver", true);
    await check(allowed("POST", "/geocode/search"), "customer", true);
    await check(allowed("POST", "/geocode/search"), "driver", true);
    await check(allowed("POST", "/geocode/search"), "admin", true);
  });
  await t("geocoding proxy provides Photon address suggestions and Nominatim reverse-geocoding", async () => {
    geocoding._clearCache();
    const seen = [];
    geocoding._setFetch(async (url, options) => {
      seen.push({ url, options });
      if (url.includes("photon.komoot.io")) return { ok: true, status: 200, json: async () => ({ features: [{ geometry: { coordinates: [77.606, 12.975] }, properties: { osm_type: "W", osm_id: 42, name: "MG Road", city: "Bengaluru", country: "India" } }] }) };
      return { ok: true, status: 200, json: async () => ({ osm_type: "way", osm_id: 42, display_name: "MG Road, Bengaluru" }) };
    });
    const found = await geocoding.search("MG Road, Bengaluru");
    assert.strictEqual(found[0].latitude, 12.975);
    assert.strictEqual(found[0].longitude, 77.606);
    assert.match(seen[0].url, /photon\.komoot\.io/);
    const reversed = await geocoding.reverse(12.975, 77.606);
    assert.match(reversed.label, /MG Road/);
    await rejects(geocoding.search("x"), 400, /3 to 250/);
    await rejects(geocoding.reverse(999, 0), 400, /latitude and longitude/);
    geocoding._setFetch((...args) => fetch(...args));
    geocoding._clearCache();
  });
  await t("admin creates a configuration (INR -> paise) and rejects bad input; unknown fields refused", async () => {
    const out = await runRoute(pricingRoutes, "POST", "/", { user: { id: String(env.oid()), role: "admin" }, body: { ratePerKm: 7.5 } });
    assert.strictEqual(out.status, 201); assert.strictEqual(out.json.config.ratePerKmPaise, 750);
    const low = await runRoute(pricingRoutes, "POST", "/", { user: { id: String(env.oid()), role: "admin" }, body: { ratePerKm: 4 } });
    assert.strictEqual(low.status, 400);
    const high = await runRoute(pricingRoutes, "POST", "/", { user: { id: String(env.oid()), role: "admin" }, body: { ratePerKm: 11 } });
    assert.strictEqual(high.status, 400);
    const extra = await runRoute(pricingRoutes, "POST", "/", { user: { id: String(env.oid()), role: "admin" }, body: { ratePerKm: 7, amountPaise: 1 } });
    assert.strictEqual(extra.status, 400);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
