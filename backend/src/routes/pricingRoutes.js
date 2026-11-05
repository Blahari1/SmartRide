const express = require("express");
const c = require("../controllers/pricingController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);

router.get("/active", allowRoles("customer", "driver", "admin"), c.getActive);
router.post("/quote", allowRoles("customer"), c.quote);
router.post("/route", allowRoles("customer", "driver", "admin"), c.route);
router.post("/geocode/search", allowRoles("customer", "driver", "admin"), c.geocodeSearch);
router.post("/geocode/reverse", allowRoles("customer", "driver", "admin"), c.geocodeReverse);
router.get("/", allowRoles("admin"), c.list);
router.post("/", allowRoles("admin"), c.create);
router.patch("/:id/status", allowRoles("admin"), c.setStatus);

module.exports = router;
