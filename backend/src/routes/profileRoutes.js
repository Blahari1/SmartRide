const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/profileController");

const router = express.Router();

router.use(authenticate, allowRoles("customer"));

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);

module.exports = router;
