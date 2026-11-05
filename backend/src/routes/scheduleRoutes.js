const express = require("express");
const c = require("../controllers/scheduleController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);

// static paths first, then parameterised ones
router.get("/my", allowRoles("customer"), c.mine);
router.get("/driver/my", allowRoles("driver"), c.driverMine);
router.get("/trips", allowRoles("admin"), c.listTrips);
router.patch("/trips/:tripId/status", allowRoles("admin", "driver"), c.setTripStatus);

router.get("/", allowRoles("admin"), c.list);
router.get("/:id", allowRoles("customer", "admin"), c.getOne);
router.post("/:id/cancel", allowRoles("admin"), c.cancel);
router.post("/:id/generate", allowRoles("admin"), c.generate);

module.exports = router;
