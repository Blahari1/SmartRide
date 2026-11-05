const Notification = require("../models/Notification");
const { HttpError, requireId, wrap } = require("../utils/validate");

// Every query is scoped to req.user.id, so roles only ever see their own notifications.
const list = wrap(async (req, res) => {
  const filter = { userId: req.user.id };
  if (req.query.unread === "true") filter.isRead = false;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user.id, isRead: false }),
  ]);
  res.json({ success: true, total, page, limit, unread, notifications: items });
});

const unreadCount = wrap(async (req, res) => {
  res.json({ success: true, unread: await Notification.countDocuments({ userId: req.user.id, isRead: false }) });
});

const markRead = wrap(async (req, res) => {
  requireId(req.params.id, "notification ID");
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { isRead: true, readAt: new Date() } }, { new: true });
  if (!n) throw new HttpError(404, "Notification not found");
  res.json({ success: true, notification: n });
});

const markAllRead = wrap(async (req, res) => {
  const r = await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  res.json({ success: true, updated: r.modifiedCount });
});

module.exports = { list, unreadCount, markRead, markAllRead };
