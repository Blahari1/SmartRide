const express = require("express");
const c = require("../controllers/subscriptionController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate);

router.post("/", allowRoles("customer"), c.create);
router.get("/my", allowRoles("customer"), c.mine);
router.get("/", allowRoles("admin"), c.listAll);
router.post("/:id/cancel", allowRoles("customer", "admin"), c.cancelOne);
router.get("/:id", allowRoles("customer", "admin"), c.getOne);

module.exports = router;
