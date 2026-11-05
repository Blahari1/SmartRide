// Non-destructive migration for the two-way commute feature. Safe to run any number of times.
//   cd backend && npm run migrate-direction
// 1. Adds direction:"outbound" to existing Schedule/Trip documents that have none (no document is removed or rewritten otherwise).
// 2. Replaces the legacy one-open-schedule-per-subscription index with the (subscriptionId, direction) index.
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Schedule = require("../models/Schedule");
const Trip = require("../models/Trip");

(async () => {
  try {
    await connectDB(); // also repairs the Schedule indexes
    const s = await Schedule.collection.updateMany({ direction: { $exists: false } }, { $set: { direction: "outbound" } });
    const t = await Trip.collection.updateMany({ direction: { $exists: false } }, { $set: { direction: "outbound" } });
    // Drop legacy indexes whose key patterns are incompatible with the current direction-aware commute model.
    for (const Model of [Schedule, Trip]) {
      const indexes = await Model.collection.indexes();
      for (const index of indexes) {
        if (
          index.name === "one_open_schedule_per_subscription" ||
          index.name === "no_duplicate_trip_per_period" ||
          index.name === "vehicle_slot_unique" ||
          index.key?.vehicleId
        ) {
          await Model.collection.dropIndex(index.name);
        }
      }
    }
    await Trip.createIndexes();
    console.log(`Schedules updated: ${s.modifiedCount}; trips updated: ${t.modifiedCount}`);
    console.log("Schedule indexes:", (await Schedule.collection.indexes()).map((i) => i.name).join(", "));
    console.log("Migration finished.");
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
