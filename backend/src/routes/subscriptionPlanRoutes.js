const express = require("express");
const router = express.Router();

const {
  getActivePlans,
  getAllPlans,
  createPlan,
  updatePlan,
  updatePlanStatus,
} = require("../controllers/subscriptionPlanController");

const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

// Public: active plans only
router.get("/", getActivePlans);

// Admin-only routes
router.get("/admin", authenticate, allowRoles("admin"), getAllPlans);
router.post("/", authenticate, allowRoles("admin"), createPlan);
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("admin"),
  updatePlanStatus,
);
router.patch("/:id", authenticate, allowRoles("admin"), updatePlan);

module.exports = router;
