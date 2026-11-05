const mongoose = require("mongoose");

// The pre-two-way schema allowed ONE open schedule per subscription via a unique index on subscriptionId alone.
// It would reject the return schedule, so it is dropped here (idempotent, no data is touched) and the new
// (subscriptionId, direction) index is built from the Schedule model.
async function repairScheduleIndexes() {
  const Schedule = require("../models/Schedule");
  try {
    const idx = await Schedule.collection.indexes();
    if (idx.some((i) => i.name === "one_open_schedule_per_subscription")) {
      await Schedule.collection.dropIndex("one_open_schedule_per_subscription");
      console.log("Dropped legacy index one_open_schedule_per_subscription");
    }
  } catch (e) {
    if (e.codeName !== "NamespaceNotFound" && e.code !== 26) console.error("Schedule index repair skipped:", e.message);
  }
  try { await Schedule.createIndexes(); } catch (e) { console.error("Schedule index build failed:", e.message); }
}

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing from environment configuration");
  }

  await mongoose.connect(uri);
  console.log("MongoDB connected successfully");
  await repairScheduleIndexes();
}

module.exports = connectDB;
module.exports.repairScheduleIndexes = repairScheduleIndexes;
