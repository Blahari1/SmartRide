const express = require("express");
const c = require("../controllers/tripController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);
router.get("/my", allowRoles("customer"), c.mine);
router.get("/:id", allowRoles("customer", "driver", "admin"), c.getOne);
module.exports = router;
