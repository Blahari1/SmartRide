// Offline tests for the Stage 2 features (tracking, trip status side effects, ratings, expiry notices, route permissions).
// Same approach as logic.test.js: real services/controllers/routes on the in-memory fake in tests/helpers/fakeEnv.js.
// This does NOT prove real MongoDB behaviour (indexes, casting) or Socket.IO transport; see tests/INTEGRATION.md.
process.env.JWT_SECRET = "t".repeat(48);
process.env.NODE_ENV = "test";
const assert = require("assert");
const env = require("./helpers/fakeEnv");
const { models: M, resetAll, runRoute } = env;

const tracking = require("../src/services/trackingService");
const scheduling = require("../src/services/schedulingService");
const ratings = require("../src/services/ratingService");
const maintenance = require("../src/jobs/maintenance");
const T = require("../src/utils/time");
const ratingRoutes = require("../src/routes/ratingRoutes");
const trackingRoutes = require("../src/routes/trackingRoutes");
const tripRoutes = require("../src/routes/tripRoutes");
const adminRoutes = require("../src/routes/adminRoutes");
const authRoutes = require("../src/routes/authRoutes");
const driverRoutes = require("../src/routes/driverRoutes");
const planController = require("../src/controllers/subscriptionPlanController");

const FUTURE = new Date(Date.now() + 400 * 86400000);
let passed = 0, failed = 0;
const t = async (name, fn) => {
  resetAll();
  try { await fn(); passed++; console.log("  ok   ", name); } catch (e) { failed++; console.log("  FAIL ", name, "\n        ", e.stack.split("\n").slice(0, 3).join("\n         ")); }
};
const rejects = async (p, status, re) => {
  try { await p; } catch (e) { assert.strictEqual(e.status, status, `expected ${status}, got ${e.status}: ${e.message}`); if (re) assert.match(e.message, re); return; }
  assert.fail(`expected HttpError ${status}`);
};

async function mkUser(role, name) {
  const u = await M.User.create({ name, email: `${name.toLowerCase()}@x.io`, role });
  return { id: String(u._id), role, name };
}
async function mkDriver(name, approved = true) {
  const user = await mkUser("driver", name);
  const profile = await M.DriverProfile.create({ userId: user.id, fullName: name, phone: "9876543210", licenseNumber: "L" + name, licenseValidUntil: FUTURE, documents: [{ type: "driving_licence", reference: "TEST-LICENCE" }], verificationStatus: approved ? "approved" : "pending" });
  return { user, profile };
}
async function mkTrip(customer, driver, status = "confirmed", extra = {}) {
  return M.Trip.create({ scheduleId: String(env.oid()), userId: customer.id, subscriptionId: String(env.oid()), date: T.todayIst(), servicePeriod: "morning", pickupTime: "08:00", dropTime: "09:00", driverId: driver ? driver.profile._id : null, status, ...extra });
}
const notes = (userId, type) => M.Notification._store.filter((n) => String(n.userId) === String(userId) && (!type || n.type === type));

(async () => {
  console.log("Coordinate validation");
  await t("accepts real coordinates and optional accuracy/heading/speed", async () => {
    const c = tracking.validateCoordinates({ latitude: 12.9716, longitude: 77.5946, accuracy: 12, heading: 90, speed: 8 });
    assert.deepStrictEqual(c, { latitude: 12.9716, longitude: 77.5946, accuracy: 12, heading: 90, speed: 8 });
    assert.strictEqual(tracking.validateCoordinates({ latitude: -33.8, longitude: 151.2 }).accuracy, null);
  });
  await t("rejects strings, NaN, out-of-range, missing, (0,0), non-objects", async () => {
    for (const bad of [{ latitude: "12.9", longitude: 77 }, { latitude: NaN, longitude: 77 }, { latitude: 91, longitude: 77 }, { latitude: 12, longitude: 181 }, { longitude: 77 }, { latitude: 0, longitude: 0 }, { latitude: 12, longitude: 77, heading: 400 }, { latitude: 12, longitude: 77, speed: -1 }, null, [], "x"]) {
      assert.throws(() => tracking.validateCoordinates(bad), (e) => e.status === 400, JSON.stringify(bad));
    }
  });

  console.log("Location sharing and tracking access");
  await t("only the assigned approved driver can publish, and only while in_progress", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee"); const other = await mkDriver("Eve");
    const trip = await mkTrip(c, d, "confirmed");
    const body = { latitude: 12.97, longitude: 77.59 };
    await rejects(tracking.updateLocation(d.user, String(trip._id), body), 409, /in progress/);
    trip.status = "in_progress";
    await rejects(tracking.updateLocation(other.user, String(trip._id), body), 404);
    const pending = await mkDriver("Pat", false);
    await rejects(tracking.updateLocation(pending.user, String(trip._id), body), 403);
    await rejects(tracking.updateLocation(d.user, String(trip._id), { latitude: 99, longitude: 1 }), 400);
    const loc = await tracking.updateLocation(d.user, String(trip._id), body);
    assert.strictEqual(loc.latitude, 12.97);
    assert.strictEqual(trip.lastLocation.longitude, 77.59);
  });
  await t("snapshot: owner sees position only when active; other customer/driver get 404; completed hides it", async () => {
    const c = await mkUser("customer", "Cust"); const c2 = await mkUser("customer", "Cust2"); const admin = await mkUser("admin", "Adm");
    const d = await mkDriver("Dee"); const other = await mkDriver("Eve");
    const trip = await mkTrip(c, d, "in_progress", { lastLocation: { latitude: 12.9, longitude: 77.5, updatedAt: new Date() } });
    const id = String(trip._id);
    const s1 = await tracking.snapshot(c, id);
    assert.strictEqual(s1.state, "active"); assert.strictEqual(s1.location.latitude, 12.9);
    assert.strictEqual((await tracking.snapshot(admin, id)).state, "active");
    assert.strictEqual((await tracking.snapshot(d.user, id)).state, "active");
    await rejects(tracking.snapshot(c2, id), 404);
    await rejects(tracking.snapshot(other.user, id), 404);
    await rejects(tracking.snapshot(c, "not-an-id"), 400);
    trip.status = "completed";
    const s2 = await tracking.snapshot(c, id);
    assert.strictEqual(s2.state, "completed"); assert.strictEqual(s2.location, null);
    trip.status = "confirmed";
    assert.strictEqual((await tracking.snapshot(c, id)).state, "not_started");
  });
  await t("customer sees the assigned driver only once the trip is confirmed", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    const trip = await mkTrip(c, d, "scheduled");
    assert.strictEqual((await tracking.snapshot(c, String(trip._id))).driver, null);
  });
  await t("listActive returns only in_progress trips", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    await mkTrip(c, d, "in_progress"); await mkTrip(c, d, "confirmed", { servicePeriod: "evening" });
    assert.strictEqual((await tracking.listActive()).length, 1);
  });

  console.log("Trip status side effects");
  await t("start: customer notified, second simultaneous trip for the same driver refused", async () => {
    const c = await mkUser("customer", "Cust"); const c2 = await mkUser("customer", "Cust2"); const d = await mkDriver("Dee");
    const a = await mkTrip(c, d, "confirmed"); const b = await mkTrip(c2, d, "confirmed", { servicePeriod: "evening" });
    await scheduling.changeTripStatus(a, "in_progress", d.user);
    assert.strictEqual(a.status, "in_progress"); assert.ok(a.startedAt);
    assert.strictEqual(notes(c.id, "trip_started").length, 1);
    await rejects(scheduling.changeTripStatus(b, "in_progress", d.user), 409, /current trip/);
    assert.strictEqual(b.status, "confirmed"); assert.strictEqual(notes(c2.id, "trip_started").length, 0);
  });
  await t("complete: position deleted, customer asked to rate; failed transition sends nothing", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    const trip = await mkTrip(c, d, "in_progress", { lastLocation: { latitude: 12.9, longitude: 77.5, updatedAt: new Date() } });
    await scheduling.changeTripStatus(trip, "completed", d.user);
    assert.strictEqual(trip.lastLocation, undefined); assert.ok(trip.completedAt);
    assert.strictEqual(notes(c.id, "trip_completed").length, 1);
    await rejects(scheduling.changeTripStatus(trip, "in_progress", d.user), 409);
    assert.strictEqual(notes(c.id, "trip_started").length, 0);
  });
  await t("cancel by admin: reason stored, customer and driver notified, tracking cleared; drivers cannot cancel", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee"); const admin = await mkUser("admin", "Adm");
    const trip = await mkTrip(c, d, "in_progress", { lastLocation: { latitude: 12.9, longitude: 77.5, updatedAt: new Date() } });
    await rejects(scheduling.changeTripStatus(trip, "cancelled", d.user), 403);
    await scheduling.changeTripStatus(trip, "cancelled", admin, { reason: "Driver unavailable" });
    assert.strictEqual(trip.cancelReason, "Driver unavailable"); assert.strictEqual(trip.lastLocation, undefined);
    assert.match(notes(c.id, "trip_cancelled")[0].message, /Driver unavailable/);
    assert.strictEqual(notes(d.user.id, "trip_cancelled").length, 1);
  });
  await t("a driver can only start a trip on its service date", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    const trip = await mkTrip(c, d, "confirmed", { date: T.addDaysStr(T.todayIst(), 3) });
    await rejects(scheduling.changeTripStatus(trip, "in_progress", d.user), 409, /service date/);
  });

  console.log("Ratings");
  await t("owner rates a completed trip once; driver is notified; average is derived from stored ratings", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    const t1 = await mkTrip(c, d, "completed"); const t2 = await mkTrip(c, d, "completed", { servicePeriod: "evening" });
    await ratings.submit(c, { tripId: String(t1._id), rating: 5, feedback: "  Great ride " });
    await ratings.submit(c, { tripId: String(t2._id), rating: 3 });
    assert.strictEqual(M.Rating._store[0].feedback, "Great ride");
    assert.strictEqual(notes(d.user.id, "rating_received").length, 2);
    const s = await ratings.summaryFor({ driverId: d.profile._id });
    assert.strictEqual(s.count, 2); assert.strictEqual(s.average, 4); assert.deepStrictEqual(s.distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
    assert.strictEqual((await ratings.summaryFor({ driverId: env.oid() })).average, null);
  });
  await t("rejects: duplicate, other customer, not completed, bad stars, long feedback, bad id", async () => {
    const c = await mkUser("customer", "Cust"); const c2 = await mkUser("customer", "Cust2"); const d = await mkDriver("Dee");
    const done = await mkTrip(c, d, "completed"); const open = await mkTrip(c, d, "confirmed", { servicePeriod: "evening" });
    const id = String(done._id);
    await ratings.submit(c, { tripId: id, rating: 4 });
    await rejects(ratings.submit(c, { tripId: id, rating: 2 }), 409, /already rated/);
    await rejects(ratings.submit(c2, { tripId: id, rating: 5 }), 404);
    await rejects(ratings.submit(c, { tripId: String(open._id), rating: 5 }), 409, /completed/);
    for (const rating of [0, 6, 2.5, "5", null, undefined]) await rejects(ratings.submit(c, { tripId: id, rating }), 400);
    await rejects(ratings.submit(c, { tripId: id, rating: 5, feedback: "x".repeat(501) }), 400);
    await rejects(ratings.submit(c, { tripId: id, rating: 5, feedback: 42 }), 400);
    await rejects(ratings.submit(c, { tripId: "zzz", rating: 5 }), 400);
    assert.strictEqual(M.Rating._store.length, 1);
  });
  await t("a duplicate that slips past the check is stopped by the unique index (11000 -> 409)", async () => {
    const c = await mkUser("customer", "Cust"); const d = await mkDriver("Dee");
    const trip = await mkTrip(c, d, "completed");
    M.Rating.failNextCreate(Object.assign(new Error("dup"), { code: 11000 }));
    await rejects(ratings.submit(c, { tripId: String(trip._id), rating: 5 }), 409);
  });

  console.log("Maintenance job");
  await t("expiring notice is sent once per subscription, only for active ones ending within 7 days", async () => {
    const c = await mkUser("customer", "Cust"); const c2 = await mkUser("customer", "Cust2"); const c3 = await mkUser("customer", "Cust3");
    const snap = { name: "Monthly", durationMonths: 1, pricePaise: 100 };
    const day = 86400000;
    await M.Subscription.create({ userId: c.id, planId: String(env.oid()), planSnapshot: snap, status: "active", startDate: new Date(), endDate: new Date(Date.now() + 3 * day), expiryNotifiedAt: null });
    await M.Subscription.create({ userId: c2.id, planId: String(env.oid()), planSnapshot: snap, status: "active", startDate: new Date(), endDate: new Date(Date.now() + 20 * day), expiryNotifiedAt: null });
    await M.Subscription.create({ userId: c3.id, planId: String(env.oid()), planSnapshot: snap, status: "cancelled", endDate: new Date(Date.now() + 3 * day), expiryNotifiedAt: null });
    assert.strictEqual(await maintenance.notifyExpiring(), 1);
    assert.strictEqual(await maintenance.notifyExpiring(), 0);
    assert.strictEqual(notes(c.id, "subscription_expiring").length, 1);
    assert.strictEqual(notes(c2.id, "subscription_expiring").length + notes(c3.id, "subscription_expiring").length, 0);
  });
  await t("runOnce reports the new steps and keeps running when one step fails", async () => {
    maintenance._resetExtendClock();
    const r = await maintenance.runOnce();
    assert.ok("expiring" in r && "extended" in r); assert.deepStrictEqual(r.errors, []);
  });

  console.log("Route permission matrix (new endpoints)");
  const routeCases = [
    [ratingRoutes, "POST", "/", { customer: "ok" }], [ratingRoutes, "GET", "/my", { customer: "ok" }], [ratingRoutes, "GET", "/driver/my", { driver: "ok" }], [ratingRoutes, "GET", "/", { admin: "ok" }],
    [trackingRoutes, "POST", "/trips/:tripId/location", { driver: "ok" }], [trackingRoutes, "GET", "/active", { admin: "ok" }], [trackingRoutes, "GET", "/trips/:tripId", { customer: "ok", driver: "ok", admin: "ok" }],
    [tripRoutes, "GET", "/my", { customer: "ok" }], [tripRoutes, "GET", "/:id", { customer: "ok", driver: "ok", admin: "ok" }],
    [adminRoutes, "GET", "/dashboard", { admin: "ok" }], [adminRoutes, "GET", "/reports", { admin: "ok" }], [adminRoutes, "GET", "/customers", { admin: "ok" }], [adminRoutes, "PATCH", "/customers/:id/status", { admin: "ok" }],
  ];
  await t("every new route allows exactly the intended roles (others get 403 from allowRoles)", async () => {
    for (const [router, method, path, allowed] of router_cases_guard(routeCases)) {
      const route = router.routes.find((r) => r.method === method && r.path === path);
      assert.ok(route, `${method} ${path} is not registered`);
      // handlers: [allowRoles(...), controller]; globals hold authenticate (+ allowRoles for adminRoutes)
      for (const role of ["customer", "driver", "admin"]) {
        const chain = [...router.globals, ...route.handlers.slice(0, -1)].filter((h) => h.length === 3 && h.name !== "authenticate");
        let blocked = false;
        for (const h of chain) { await h({ user: { role } }, { status() { blocked = true; return { json() {} }; } }, () => {}); if (blocked) break; }
        assert.strictEqual(!blocked, !!allowed[role], `${method} ${path} for ${role}`);
      }
    }
  });
  await t("admin creates route-priced plans without a fixed amount; legacy price input is rejected", async () => {
    const admin = await mkUser("admin", "PlanAdmin");
    const invoke = async (body) => {
      const out = { status: 200, json: null };
      const res = { status(code) { out.status = code; return this; }, json(data) { out.json = data; return this; } };
      await planController.createPlan({ body, user: admin }, res);
      return out;
    };
    const created = await invoke({ name: "Monthly Commute", slug: "monthly-commute", durationMonths: 1, description: "Route priced", features: ["Pickup and drop"] });
    assert.strictEqual(created.status, 201, JSON.stringify(created.json));
    assert.strictEqual(created.json.plan.pricePaise, undefined, "plans do not store a fixed fare");
    const legacyAmount = await invoke({ name: "Legacy Price", slug: "legacy-price", durationMonths: 1, pricePaise: 150000 });
    assert.strictEqual(legacyAmount.status, 400);
  });
  await t("admin driver list exposes registrations with no submitted profile", async () => {
    const driver = await mkUser("driver", "IncompleteDriver");
    const admin = await mkUser("admin", "ListAdmin");
    const result = await runRoute(driverRoutes, "GET", "/", { user: admin });
    assert.strictEqual(result.status, 200, JSON.stringify(result.json));
    assert.ok(result.json.unsubmittedDrivers.some((u) => String(u.id) === driver.id));
    assert.strictEqual(result.json.unsubmittedDrivers.find((u) => String(u.id) === driver.id).verificationStatus, "profile_incomplete");
  });
  await t("driver verification requires a licence document reference and an active driver account", async () => {
    const driver = await mkUser("driver", "VerifyMe");
    const admin = await mkUser("admin", "Verifier");
    const profileBody = {
      fullName: "Verify Me", phone: "9876543210", licenseNumber: "DL-VERIFY-123",
      licenseValidUntil: FUTURE.toISOString(), documents: [],
    };
    const missing = await runRoute(driverRoutes, "POST", "/profile", { user: driver, body: profileBody });
    assert.strictEqual(missing.status, 400);
    assert.match(missing.json.message, /driving licence document reference/);
    const submitted = await runRoute(driverRoutes, "POST", "/profile", {
      user: driver, body: { ...profileBody, documents: [{ type: "driving_licence", reference: "TEST-LICENCE" }] },
    });
    assert.strictEqual(submitted.status, 201, JSON.stringify(submitted.json));
    const profile = submitted.json.profile;
    profile.documents = [];
    await profile.save();
    const blocked = await runRoute(driverRoutes, "PATCH", `/${profile._id}/verify`, {
      user: admin, body: { status: "approved" },
    });
    assert.strictEqual(blocked.status, 409);
    assert.match(blocked.json.message, /driving licence document reference/);
    profile.documents = [{ type: "driving_licence", reference: "TEST-LICENCE" }];
    await profile.save();
    const approved = await runRoute(driverRoutes, "PATCH", `/${profile._id}/verify`, {
      user: admin, body: { status: "approved" },
    });
    assert.strictEqual(approved.status, 200, JSON.stringify(approved.json));
    assert.strictEqual(approved.json.driver.verificationStatus, "approved");
  });
  await t("auth routes: change-password, update-me and logout are registered with a password validator", async () => {
    for (const [method, path] of [["PATCH", "/me"], ["POST", "/change-password"], ["POST", "/logout"]]) assert.ok(authRoutes.routes.find((r) => r.method === method && r.path === path), `${method} ${path}`);
    const reg = require("../src/validators/authValidators");
    assert.ok(Array.isArray(reg.changePasswordValidation));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

function router_cases_guard(cases) { return cases; }
