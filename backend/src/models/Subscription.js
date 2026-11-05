const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true, immutable: true },
    // Snapshot taken at request time: later plan edits never alter history.
    planSnapshot: {
      name: { type: String, required: true },
      durationMonths: { type: Number, required: true },
      pricePaise: { type: Number, required: true },
      description: { type: String, default: "" },
    },
    // Distance-based fare, calculated by the server from the customer's saved locations (OSRM road distance) and the
    // pricing configuration that was active at request time. Absent on legacy fixed-price subscriptions, which keep their original price.
    // When present, planSnapshot.pricePaise mirrors fareSnapshot.totalPaise for legacy UI compatibility.
    fareSnapshot: { type: mongoose.Schema.Types.Mixed, default: undefined },
    // Dates are computed by the server when a verified driver accepts the request.
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverProfile", default: null, index: true },
    acceptedAt: { type: Date, default: null },
    requestSchedule: {
      pickupTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      dropTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      returnPickupTime: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      returnDropTime: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      serviceDays: { type: [Number], required: true },
      directions: { type: [String], enum: ["outbound", "return"], required: true },
    },
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "expired"],
      default: "pending",
      required: true,
    },
    cancelledAt: { type: Date, default: null },
    // Set once the "expiring soon" notification has been sent (the maintenance job never sends it twice).
    expiryNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
// At most one ACTIVE and at most one PENDING subscription per customer (race-safe).
// The active index is unchanged from the original schema (default name userId_1) so an existing database keeps working.
// The pending index uses a different key pattern ({userId, status}) because MongoDB < 7.3 rejects two partial indexes
// that share a key pattern.
subscriptionSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
subscriptionSchema.index({ userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_per_user" });

module.exports = mongoose.model("Subscription", subscriptionSchema);
