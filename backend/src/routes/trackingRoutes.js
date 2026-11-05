const express = require("express");
const c = require("../controllers/trackingController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);
router.get("/active", allowRoles("admin"), c.active);
router.post("/trips/:tripId/location", allowRoles("driver"), c.postLocation);
router.get("/trips/:tripId", allowRoles("customer", "driver", "admin"), c.getTrip);
module.exports = router;
