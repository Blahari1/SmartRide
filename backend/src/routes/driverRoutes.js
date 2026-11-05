const express = require("express");
const c = require("../controllers/driverController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);

// driver self-service
router.post("/profile", allowRoles("driver"), c.createMine);
router.get("/me", allowRoles("driver"), c.getMine);
router.patch("/me", allowRoles("driver"), c.updateMine);
router.get("/me/dashboard", allowRoles("driver"), c.dashboard);
router.get("/me/customers", allowRoles("driver"), c.myCustomers);
router.patch("/me/availability", allowRoles("driver"), c.setMyAvailability);
router.get("/requests", allowRoles("driver"), c.availableRequests);
router.post("/requests/:id/accept", allowRoles("driver"), c.acceptRequest);

// admin
router.get("/", allowRoles("admin"), c.list);
router.get("/pending", allowRoles("admin"), c.listPending);
router.get("/:id", allowRoles("admin"), c.getOne);
router.patch("/:id/verify", allowRoles("admin"), c.verify);
router.patch("/:id/availability", allowRoles("admin"), c.setAvailability);

module.exports = router;
