const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["driving_licence", "id_proof", "address_proof", "other"], required: true },
    // Reference only (e.g. document number or a link to a private storage object). No file bytes are stored in MongoDB.
    reference: { type: String, trim: true, required: true, maxlength: 500 },
  },
  { _id: false },
);

const driverProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, immutable: true },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, trim: true, minlength: 7, maxlength: 20 },
    licenseNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30, unique: true },
    licenseValidUntil: { type: Date, required: true },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    documents: { type: [documentSchema], default: [] },
    verificationStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectionReason: { type: String, trim: true, maxlength: 300, default: "" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    availability: { type: String, enum: ["available", "unavailable"], default: "available" },
    // Short-lived lock prevents simultaneous accepts from bypassing recurring-slot conflict checks.
    dispatchLockUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DriverProfile", driverProfileSchema);
