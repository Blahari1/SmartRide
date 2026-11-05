const express = require("express");
const c = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticate);
router.get("/", c.list);
router.get("/unread-count", c.unreadCount);
router.patch("/read-all", c.markAllRead);
router.patch("/:id/read", c.markRead);
module.exports = router;
