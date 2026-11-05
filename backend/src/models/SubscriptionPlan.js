const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    durationMonths: {
      type: Number,
      required: true,
      enum: [1, 3, 6, 12, 24, 36, 48, 60],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    features: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, durationMonths: 1 });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
