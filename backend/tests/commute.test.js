// Offline tests for the two-way commute (outbound Home->College/Office, return College/Office->Home).
// Runs the REAL schedulingService on the in-memory fake (tests/helpers/fakeEnv.js). It does NOT prove real MongoDB
// index behaviour; see tests/INTEGRATION.md section "Two-way commute".
process.env.JWT_SECRET = "t".repeat(48);
process.env.NODE_ENV = "test";
const assert = require("assert");
const env = require("./helpers/fakeEnv");
const { models: M, resetAll } = env;
const scheduling = require("../src/services/schedulingService");
const T = require("../src/utils/time");

const FUTURE = new Date(Date.now() + 400 * 86400000);
let passed = 0, failed = 0;
const t = async (name, fn) => {
  resetAll();
  try { await fn(); passed++; console.log("  ok   ", name); } catch (e) { failed++; console.log("  FAIL ", name, "\n        ", e.stack.split("\n").slice(0, 4).join("\n         ")); }
};
const rejects = async (p, status, re) => {
  try { await p; } catch (e) { assert.strictEqual(e.status, status, `expected ${status}, got ${e.status}: ${e.message}`); if (re) assert.match(e.message, re); return; }
  assert.fail(`expected HttpError ${status}`);
};

const HOME = { address: "12 Home Street", landmark: "", latitude: 12.97, longitude: 77.59 };
const COLLEGE = { address: "ABC College", landmark: "", latitude: 13.01, longitude: 77.55 };

async function setup() {
  const cu = await M.User.create({ name: "Cust", email: "c@x.io", role: "customer" });
  await M.CustomerProfile.create({ userId: cu._id, pickupLocation: HOME, dropLocation: COLLEGE });
  const sub = await M.Subscription.create({ userId: cu._id, status: "active", startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 60 * 86400000) });
  const du = await M.User.create({ name: "Drv", email: "d@x.io", role: "driver" });
  const driver = await M.DriverProfile.create({ userId: du._id, fullName: "Drv", phone: "9876543210", licenseNumber: "L1", licenseValidUntil: FUTURE, documents: [{ type: "driving_licence", reference: "TEST-LICENCE" }], verificationStatus: "approved" });
  const today = T.todayIst();
  const input = { subscriptionId: String(sub._id), serviceDays: [0, 1, 2, 3, 4, 5, 6], startDate: today, endDate: T.addDaysStr(today, 9), pickupTime: "08:00", dropTime: "09:00", driverId: String(driver._id) };
  return { cu, sub, driver, input };
}

(async () => {
  console.log("Two-way commute");
  await t("one request creates an outbound and a return schedule with swapped locations and independent trips", async () => {
    const { input, sub } = await setup();
    const r = await scheduling.createCommute({ ...input, returnPickupTime: "17:00", returnDropTime: "18:00" }, "a".repeat(24));
    assert.strictEqual(r.outbound.direction, "outbound");
    assert.strictEqual(r.return.direction, "return");
    assert.strictEqual(r.outbound.pickupLocation.address, HOME.address);
    assert.strictEqual(r.outbound.dropLocation.address, COLLEGE.address);
    assert.strictEqual(r.return.pickupLocation.address, COLLEGE.address);
    assert.strictEqual(r.return.dropLocation.address, HOME.address);
    assert.strictEqual(String(r.outbound.subscriptionId), String(sub._id));
    assert.strictEqual(String(r.return.subscriptionId), String(sub._id));
    const out = M.Trip._store.filter((x) => x.direction === "outbound");
    const ret = M.Trip._store.filter((x) => x.direction === "return");
    assert.strictEqual(out.length, 10); assert.strictEqual(ret.length, 10);
    assert.ok(out.every((x) => x.servicePeriod === "morning") && ret.every((x) => x.servicePeriod === "evening"));
    assert.ok(ret.every((x) => x.pickupLocation.address === COLLEGE.address));
  });
  await t("a second open schedule in the SAME direction is rejected; the other direction is allowed", async () => {
    const { input } = await setup();
    await scheduling.createSchedule({ ...input, direction: "outbound" }, "a".repeat(24));
    await rejects(scheduling.createSchedule({ ...input, direction: "outbound", pickupTime: "10:00", dropTime: "11:00" }, "a".repeat(24)), 409, /open outbound schedule/);
    const ret = await scheduling.createSchedule({ ...input, direction: "return", pickupTime: "17:00", dropTime: "18:00" }, "a".repeat(24));
    assert.strictEqual(ret.direction, "return");
  });
  await t("legacy schedule without a direction counts as outbound: blocks a new outbound, allows a return", async () => {
    const { input, sub, cu } = await setup();
    await M.Schedule.create({ userId: cu._id, subscriptionId: sub._id, pickupLocation: HOME, dropLocation: COLLEGE, pickupTime: "08:00", dropTime: "09:00", servicePeriod: "morning", serviceDays: [1], startDate: input.startDate, endDate: input.endDate, status: "scheduled", isOpen: true });
    await rejects(scheduling.createSchedule({ ...input }, "a".repeat(24)), 409, /open outbound schedule/);
    const ret = await scheduling.createSchedule({ ...input, direction: "return", pickupTime: "17:00", dropTime: "18:00" }, "a".repeat(24));
    assert.strictEqual(ret.direction, "return");
  });
  await t("overlapping return slot is rejected (customer and driver cannot be double-booked) and the outbound is rolled back", async () => {
    const { input } = await setup();
    await rejects(scheduling.createCommute({ ...input, returnPickupTime: "08:30", returnDropTime: "09:30" }, "a".repeat(24)), 409, /overlapping/);
    assert.strictEqual(M.Schedule._store.filter((s) => s.isOpen).length, 0, "outbound schedule must be rolled back");
    assert.strictEqual(M.Trip._store.filter((x) => x.isOpen !== false && ["scheduled", "confirmed"].includes(x.status)).length, 0, "outbound trips must be rolled back");
  });
  await t("recurring driver time conflicts are checked across the full subscription term", async () => {
    const { cu, driver, sub } = await setup();
    const today = T.todayIst();
    const end = T.addDaysStr(today, 60);
    await M.Schedule.create({
      userId: cu._id, subscriptionId: sub._id, driverId: driver._id,
      pickupLocation: HOME, dropLocation: COLLEGE, pickupTime: "08:00", dropTime: "09:00",
      servicePeriod: "morning", direction: "outbound", serviceDays: [1, 3, 5],
      startDate: today, endDate: end, status: "confirmed", isOpen: true,
    });
    await rejects(scheduling.assertRecurringNoConflicts({
      driverId: driver._id, userId: env.oid(), serviceDays: [1, 3],
      startDate: today, endDate: end, startMin: 8 * 60 + 30, endMin: 9 * 60 + 30,
    }), 409, /Driver already has an overlapping recurring commute/);
  });
  await t("invalid direction is rejected", async () => {
    const { input } = await setup();
    await rejects(scheduling.createSchedule({ ...input, direction: "sideways" }, "a".repeat(24)), 400, /direction/);
  });
  await t("cancelling the subscription cancels BOTH directions", async () => {
    const { input, sub } = await setup();
    await scheduling.createCommute({ ...input, returnPickupTime: "17:00", returnDropTime: "18:00" }, "a".repeat(24));
    await scheduling.cancelForSubscription(sub._id, "test");
    assert.ok(M.Schedule._store.every((s) => s.status === "cancelled"));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
