const Notification = require("../models/Notification");

// Real-time delivery is plugged in by the Socket.IO layer (setEmitter). Without it, notifications are still stored.
let emitter = null;
function setEmitter(fn) { emitter = fn; }

async function sendEmail(userId, title, message) {
  if (!process.env.SMTP_HOST) return; // optional: the app works without SMTP
  try {
    const User = require("../models/User");
    const nodemailer = require("nodemailer"); // loaded lazily so a missing SMTP setup never breaks startup
    const user = await User.findById(userId).select("email name");
    if (!user) return;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM || "SmartRide <no-reply@smartride.local>", to: user.email, subject: title, text: `${message}\n\n- SmartRide` });
  } catch (e) {
    console.error("Notification email failed:", e.message);
  }
}

// Never throws: a notification failure must not break the business operation that triggered it.
async function notify(userId, { type, category, title, message, related = null, email = false }) {
  if (!userId) return null;
  try {
    const n = await Notification.create({
      userId, type, category, title, message,
      related: related ? { kind: related.kind, id: related.id } : undefined,
    });
    if (emitter) { try { emitter(String(userId), n); } catch (e) { console.error("Notification emit failed:", e.message); } }
    if (email) sendEmail(userId, title, message);
    return n;
  } catch (e) {
    console.error("Notification create failed:", e.message);
    return null;
  }
}

// Fan-out to every active admin (e.g. a driver submitted documents). Never throws.
async function notifyAdmins(payload) {
  try {
    const User = require("../models/User");
    const admins = await User.find({ role: "admin", isActive: true }).select("_id");
    await Promise.all(admins.map((a) => notify(a._id, payload)));
  } catch (e) {
    console.error("Admin notification failed:", e.message);
  }
}

module.exports = { notify, notifyAdmins, setEmitter };
