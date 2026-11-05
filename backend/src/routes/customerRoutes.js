const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { wrap } = require("../utils/validate");
const reports = require("../services/reportService");

const router = express.Router();
router.use(authenticate, allowRoles("customer"));
router.get("/me/dashboard", wrap(async (req, res) => res.json({ success: true, ...(await reports.customerDashboard(req.user.id)) })));
module.exports = router;
