const express = require("express");
const c = require("../controllers/ratingController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);
router.post("/", allowRoles("customer"), c.create);
router.get("/my", allowRoles("customer"), c.mine);
router.get("/driver/my", allowRoles("driver"), c.driverMine);
router.get("/", allowRoles("admin"), c.list);
module.exports = router;
