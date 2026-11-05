const User = require("../models/User");
const CustomerProfile = require("../models/CustomerProfile");

const LOCATION_FIELDS = ["address", "landmark", "latitude", "longitude", "placeId", "source"];
const SOURCES = ["search", "gps", "map"];

function validateLocation(location, name) {
  if (location === undefined) return null;

  if (!location || typeof location !== "object" || Array.isArray(location)) {
    return `${name} must be an object`;
  }

  const extraFields = Object.keys(location).filter(
    (key) => !LOCATION_FIELDS.includes(key),
  );

  if (extraFields.length) {
    return `${name} contains unsupported fields`;
  }

  if (
    typeof location.address !== "string" ||
    location.address.trim().length > 300
  ) {
    return `${name}.address must be a string of at most 300 characters`;
  }

  if (
    location.landmark !== undefined &&
    (typeof location.landmark !== "string" ||
      location.landmark.trim().length > 150)
  ) {
    return `${name}.landmark must be a string of at most 150 characters`;
  }

  const { latitude, longitude } = location;

  if (location.placeId != null && (typeof location.placeId !== "string" || location.placeId.length > 100)) {
    return `${name}.placeId must be text of at most 100 characters`;
  }
  if (location.source != null && !SOURCES.includes(location.source)) {
    return `${name}.source must be one of ${SOURCES.join(", ")}`;
  }
  // An address is never saved without real map coordinates (they are what routing and fares are computed from).
  if (typeof location.address === "string" && location.address.trim() && (latitude == null || longitude == null)) {
    return `${name} needs map coordinates: search for the address or place the marker on the map`;
  }

  if ((latitude == null) !== (longitude == null)) {
    return `${name} must provide both latitude and longitude`;
  }

  if (
    latitude != null &&
    (typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90)
  ) {
    return `${name}.latitude must be between -90 and 90`;
  }

  if (
    longitude != null &&
    (typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180)
  ) {
    return `${name}.longitude must be between -180 and 180`;
  }

  return null;
}

async function getMyProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select(
      "name email phone role isActive createdAt",
    );

    if (!user || !user.isActive || user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Customer account required",
      });
    }

    let profile = await CustomerProfile.findOne({
      userId: user._id,
    });

    if (!profile) {
      profile = await CustomerProfile.create({
        userId: user._id,
      });
    }

    return res.json({
      success: true,
      user,
      profile,
    });
  } catch (error) {
    next(error);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const allowedFields = ["name", "phone", "pickupLocation", "dropLocation"];

    const unexpectedFields = Object.keys(req.body).filter(
      (key) => !allowedFields.includes(key),
    );

    if (unexpectedFields.length) {
      return res.status(400).json({
        success: false,
        message: "Unsupported fields in request",
        fields: unexpectedFields,
      });
    }

    const { name, phone, pickupLocation, dropLocation } = req.body;

    if (
      name === undefined &&
      phone === undefined &&
      pickupLocation === undefined &&
      dropLocation === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    if (
      name !== undefined &&
      (typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 80)
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 80 characters",
      });
    }

    if (
      phone !== undefined &&
      phone !== null &&
      (typeof phone !== "string" ||
        phone.trim().length < 7 ||
        phone.trim().length > 20)
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone must contain 7 to 20 characters",
      });
    }

    const pickupError = validateLocation(pickupLocation, "pickupLocation");
    const dropError = validateLocation(dropLocation, "dropLocation");

    if (pickupError || dropError) {
      return res.status(400).json({
        success: false,
        message: pickupError || dropError,
      });
    }

    const user = await User.findById(req.user.id);

    if (!user || !user.isActive || user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Customer account required",
      });
    }

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) {
      user.phone = phone === null ? null : phone.trim();
    }

    await user.save();

    const profileUpdate = {};

    if (pickupLocation !== undefined) {
      profileUpdate.pickupLocation = pickupLocation;
    }

    if (dropLocation !== undefined) {
      profileUpdate.dropLocation = dropLocation;
    }

    let profile = await CustomerProfile.findOne({
      userId: user._id,
    });

    if (!profile) {
      profile = await CustomerProfile.create({
        userId: user._id,
        ...profileUpdate,
      });
    } else if (Object.keys(profileUpdate).length) {
      Object.assign(profile, profileUpdate);
      await profile.save();
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      profile,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};
