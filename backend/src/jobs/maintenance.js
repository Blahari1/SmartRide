const subs = require("../services/subscriptionService");
const Subscription = require("../models/Subscription");
const Schedule = require("../models/Schedule");
const scheduling = require("../services/schedulingService");
const { notify } = require("../services/notificationService");

const EXPIRY_NOTICE_DAYS = 7;
const EXTEND_EVERY_MS = (Number(process.env.JOB_EXTEND_TRIPS_HOURS) || 6) * 3600 * 1000;
let lastExtend = 0;

// "Expiring soon" notice: sent once per subscription (atomic claim on expiryNotifiedAt, so concurrent ticks cannot duplicate it).
async function notifyExpiring() {
  const now = new Date();
  const soon = await Subscription.find({ status: "active", expiryNotifiedAt: null, endDate: { $gt: now, $lte: new Date(now.getTime() + EXPIRY_NOTICE_DAYS * 86400000) } });
  let n = 0;
  for (const s of soon) {
    const claimed = await Subscription.findOneAndUpdate({ _id: s._id, status: "active", expiryNotifiedAt: null }, { $set: { expiryNotifiedAt: new Date() } }, { new: true });
    if (!claimed) continue;
    await notify(s.userId, { type: "subscription_expiring", category: "subscription", title: "Subscription expiring soon", message: `Your ${s.planSnapshot.name} subscription ends on ${new Date(s.endDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. Renew to keep your rides.`, related: { kind: "subscription", id: s._id }, email: true });
    n++;
  }
  return n;
}

// Trips are materialised 30 days ahead; this rolls the window forward for every open schedule (idempotent).
async function extendTripWindows() {
  const open = await Schedule.find({ isOpen: true, driverId: { $ne: null } });
  let n = 0;
  for (const s of open) {
    try { await scheduling.generateTrips(s._id); n++; } catch (e) { console.error(`Trip window extension skipped for schedule ${s._id}: ${e.message}`); }
  }
  return n;
}

// Background maintenance: expire subscriptions, notify customers before expiry, and extend recurring trip windows.
async function runOnce() {
  const result = { expired: 0, expiring: 0, extended: 0, errors: [] };
  const step = async (name, fn) => { try { return await fn(); } catch (e) { result.errors.push(`${name}: ${e.message}`); return 0; } };

  await step("expire", () => subs.expireOnly({}));
  result.expiring = await step("notify-expiring", notifyExpiring);
  if (Date.now() - lastExtend >= EXTEND_EVERY_MS) {
    lastExtend = Date.now();
    result.extended = await step("extend-trip-windows", extendTripWindows);
  }
  return result;
}

let timer = null;
let running = false;

function start({ intervalMs = Number(process.env.JOB_INTERVAL_MS) || 60000 } = {}) {
  if (timer || process.env.JOBS_ENABLED === "false") return null;
  const tick = async () => {
    if (running) return; // skip, never overlap within one process
    running = true;
    try {
      const r = await runOnce();
      if (r.errors.length) console.error("Maintenance job errors:", r.errors.join(" | "));
    } catch (e) {
      console.error("Maintenance job failed:", e.message);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  timer.unref();
  tick(); // run once at startup so a server that was down catches up immediately
  console.log(`Maintenance job started (every ${Math.round(intervalMs / 1000)}s)`);
  return timer;
}

function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { runOnce, start, stop, notifyExpiring, extendTripWindows, _resetExtendClock: () => { lastExtend = 0; } };
