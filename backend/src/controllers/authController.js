const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const { createAccessToken } = require("../utils/token");
const { notify } = require("../services/notificationService");
const { HttpError, pickAllowed } = require("../utils/validate");
const { emailCandidates } = require("../utils/email");

function validationFailed(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) return false;

  res.status(400).json({
    success: false,
    errors: errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    })),
  });

  return true;
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    if (validationFailed(req, res)) return;

    const { name, email, password, phone, accountType } = req.body;
    // Only customer and driver self-registration exists. "admin" can never be requested here.
    const role = accountType === "driver" ? "driver" : "customer";

    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 72 UTF-8 bytes",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const passwordHash = await bcrypt.hash(password, rounds);

    const user = await User.create({
      name,
      email: normalizedEmail,
      phone: phone || null,
      passwordHash,
      role,
    });

    await notify(user._id, {
      type: "account_registered", category: "account", title: "Welcome to SmartRide",
      message: role === "driver" ? "Your driver account was created. Complete your driver profile and documents to start verification." : "Your account was created. Add your pickup and drop locations, then choose a plan.",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: safeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    next(error);
  }
}

async function login(req, res, next) {
  try {
    if (validationFailed(req, res)) return;

    const { email, password } = req.body;

    const user = await User.findOne({
      email: { $in: emailCandidates(email) },
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    const token = createAccessToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser(user),
    });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable",
      });
    }

    return res.status(200).json({
      success: true,
      user: safeUser(user),
    });
  } catch (error) {
    next(error);
  }
}

// Self-service account settings. Role and email can never be changed here.
async function updateMe(req, res, next) {
  try {
    pickAllowed(req.body, ["name", "phone"]);
    const { name, phone } = req.body;
    const set = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) throw new HttpError(400, "Name must contain 2 to 80 characters");
      set.name = name.trim();
    }
    if (phone !== undefined) {
      if (phone !== null && (typeof phone !== "string" || !/^[0-9+\-\s]{7,20}$/.test(phone.trim()))) throw new HttpError(400, "Phone number must contain 7 to 20 digits");
      set.phone = phone === null || phone.trim() === "" ? null : phone.trim();
    }
    if (!Object.keys(set).length) throw new HttpError(400, "Provide at least one field to update");
    const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true });
    return res.json({ success: true, message: "Account updated", user: safeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    if (validationFailed(req, res)) return;
    const { currentPassword, newPassword } = req.body;
    if (Buffer.byteLength(newPassword, "utf8") > 72) throw new HttpError(400, "Password must not exceed 72 UTF-8 bytes");
    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, "Current password is incorrect");
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new HttpError(400, "New password must be different from the current one");
    user.passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 12));
    await user.save();
    return res.json({ success: true, message: "Password changed" });
  } catch (error) {
    next(error);
  }
}

// Tokens are stateless JWTs (15 min by default): logging out clears the token in the browser. The endpoint exists so
// clients have one place to call; it does not revoke tokens server-side (documented limitation).
function logout(req, res) {
  return res.json({ success: true, message: "Logged out. Remove the token on the client." });
}

module.exports = { register, login, getMe, updateMe, changePassword, logout };
