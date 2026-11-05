const mongoose = require("mongoose");

// Admin-managed rate per road kilometre. Every change creates a new immutable configuration version.
// Money is stored in integer paise. Each subscription keeps the rate snapshot used for its estimate.
const pricingConfigSchema = new mongoose.Schema(
  {
    ratePerKmPaise: {
      type: Number, required: true, min: 500, max: 1000,
      validate: { validator: Number.isSafeInteger, message: "Rate must be a whole number of paise" },
    },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
    note: { type: String, trim: true, maxlength: 300, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", immutable: true },
  },
  { timestamps: true },
);
pricingConfigSchema.index({ isActive: 1, effectiveFrom: -1 });

module.exports = mongoose.model("PricingConfig", pricingConfigSchema);
