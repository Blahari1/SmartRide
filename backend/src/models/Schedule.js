const mongoose = require("mongoose");

const locationSnap = new mongoose.Schema(
  { address: String, landmark: String, latitude: Number, longitude: Number },
  { _id: false },
);

// Recurring rule. Individual rides live in the Trip collection.
// Times are IST wall-clock "HH:mm"; startDate/endDate are IST calendar dates "YYYY-MM-DD".
const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, immutable: true },
    pickupLocation: { type: locationSnap, required: true },
    dropLocation: { type: locationSnap, required: true },
    pickupTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    dropTime: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    servicePeriod: { type: String, enum: ["morning", "evening"], required: true },
    // outbound = Home -> College/Office, return = College/Office -> Home.
    // Legacy documents have no value and are treated as "outbound" everywhere (see utils/direction.js).
    direction: { type: String, enum: ["outbound", "return"], default: "outbound" },
    serviceDays: { type: [Number], required: true, validate: (v) => v.length > 0 && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverProfile", default: null, index: true },
    status: { type: String, enum: ["scheduled", "confirmed", "completed", "cancelled"], default: "scheduled", required: true },
    // true while the schedule still holds a slot (used by partial unique indexes)
    isOpen: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true },
);

scheduleSchema.pre("validate", function () {
  this.isOpen = ["scheduled", "confirmed"].includes(this.status);
});
// One open recurring schedule per subscription AND direction (one outbound + one return can coexist).
// The legacy index "one_open_schedule_per_subscription" (subscriptionId only) is dropped by config/db.js at startup
// and by `npm run migrate-direction`; otherwise it would block the return schedule.
scheduleSchema.index({ subscriptionId: 1, direction: 1 }, { unique: true, partialFilterExpression: { isOpen: true }, name: "one_open_schedule_per_subscription_direction" });

module.exports = mongoose.model("Schedule", scheduleSchema);
