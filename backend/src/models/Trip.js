const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule", required: true, immutable: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, immutable: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // IST service day
    servicePeriod: { type: String, enum: ["morning", "evening"], required: true },
    direction: { type: String, enum: ["outbound", "return"], default: "outbound" },
    pickupTime: { type: String, required: true },
    dropTime: { type: String, default: null },
    pickupAt: { type: Date, required: true }, // UTC instant
    dropAt: { type: Date, default: null },
    startMin: { type: Number, required: true }, // minutes since IST midnight (overlap checks)
    endMin: { type: Number, required: true },
    pickupLocation: { address: String, landmark: String, latitude: Number, longitude: Number },
    dropLocation: { address: String, landmark: String, latitude: Number, longitude: Number },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverProfile", default: null },
    status: { type: String, enum: ["scheduled", "confirmed", "in_progress", "completed", "cancelled"], default: "scheduled", required: true },
    isOpen: { type: Boolean, default: true }, // false once completed/cancelled
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 300, default: "" },
    // Latest shared position. Written only while status is "in_progress" and removed when the trip completes or is cancelled.
    lastLocation: {
      type: new mongoose.Schema(
        {
          latitude: { type: Number, min: -90, max: 90, required: true },
          longitude: { type: Number, min: -180, max: 180, required: true },
          accuracy: { type: Number, min: 0, default: null },
          heading: { type: Number, min: 0, max: 360, default: null },
          speed: { type: Number, min: 0, default: null },
          updatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

tripSchema.pre("validate", function () {
  this.isOpen = !["completed", "cancelled"].includes(this.status);
});

tripSchema.index({ scheduleId: 1, date: 1 }, { unique: true });
tripSchema.index({ date: 1, status: 1 });
tripSchema.index({ driverId: 1, date: 1 });
tripSchema.index({ userId: 1, date: 1 });
tripSchema.index({ status: 1, driverId: 1 });
// A customer may have an outbound and return trip on the same service day.
tripSchema.index({ userId: 1, date: 1, direction: 1 }, { unique: true, partialFilterExpression: { isOpen: true }, name: "no_duplicate_trip_per_direction" });
// A driver can have only one trip in progress at a time.
tripSchema.index({ driverId: 1 }, { unique: true, partialFilterExpression: { status: "in_progress", driverId: { $type: "objectId" } }, name: "one_active_trip_per_driver" });
// Hard stop for two open trips starting at the same minute for one driver (race backstop; overlap is checked in the service).
tripSchema.index({ driverId: 1, date: 1, startMin: 1 }, { unique: true, partialFilterExpression: { isOpen: true, driverId: { $type: "objectId" } }, name: "driver_slot_unique" });

module.exports = mongoose.model("Trip", tripSchema);
