const express = require("express");
const { register, login, getMe, updateMe, changePassword, logout } = require("../controllers/authController");
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
} = require("../validators/authValidators");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);
router.post("/change-password", authenticate, changePasswordValidation, changePassword);
router.post("/logout", authenticate, logout);

module.exports = router;
