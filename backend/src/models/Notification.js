const mongoose = require("mongoose");

const CATEGORIES = ["account", "driver", "subscription", "schedule", "trip", "rating"];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, maxlength: 60 },
    category: { type: String, enum: CATEGORIES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 400 },
    related: {
      kind: { type: String, enum: ["subscription", "schedule", "trip", "rating", "driver", null], default: null },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.CATEGORIES = CATEGORIES;
