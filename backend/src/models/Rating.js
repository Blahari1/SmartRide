const mongoose = require("mongoose");

// One rating per completed trip, written only by the customer who owns the trip (see services/ratingService.js).
const ratingSchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, immutable: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverProfile", required: true, immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger, immutable: true },
    feedback: { type: String, trim: true, maxlength: 500, default: "", immutable: true },
  },
  { timestamps: true },
);

ratingSchema.index({ driverId: 1, createdAt: -1 });
ratingSchema.index({ rating: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
