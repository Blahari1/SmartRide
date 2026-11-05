const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    // Identifier returned by the geocoder (e.g. "osm:way:123") and how the point was chosen. Informational only.
    placeId: { type: String, trim: true, maxlength: 100, default: "" },
    source: { type: String, enum: ["search", "gps", "map", ""], default: "" },
  },
  { _id: false },
);

const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true,
    },
    pickupLocation: {
      type: locationSchema,
      default: () => ({}),
    },
    dropLocation: {
      type: locationSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CustomerProfile", customerProfileSchema);
