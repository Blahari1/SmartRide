const express = require("express");
const c = require("../controllers/adminController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();
router.use(authenticate, allowRoles("admin"));
router.get("/dashboard", c.dashboard);
router.get("/reports", c.report);
router.get("/customers", c.listCustomers);
router.get("/customers/:id", c.getCustomer);
router.patch("/customers/:id/status", c.setCustomerStatus);
module.exports = router;
