const express = require("express");
const User = require("../models/User");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", authenticate, allowRoles("admin"), async (req, res, next) => {
  try {
    const users = await User.find()
      .select("name email phone role isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
