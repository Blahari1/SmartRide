const { body } = require("express-validator");

const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must contain 2 to 80 characters"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),

  body("password")
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must contain 8 to 72 characters"),

  body("phone")
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage("Phone number must contain 7 to 20 characters"),

  body("accountType")
    .optional()
    .isIn(["customer", "driver"])
    .withMessage("accountType must be customer or driver"),
];

// No normalizeEmail() here: the controller looks up both the typed and the normalised form (see utils/email.js).
const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address"),

  body("password").isString().notEmpty().withMessage("Password is required"),
];

const changePasswordValidation = [
  body("currentPassword").isString().notEmpty().withMessage("Current password is required"),
  body("newPassword").isString().isLength({ min: 8, max: 72 }).withMessage("New password must contain 8 to 72 characters"),
];

module.exports = { registerValidation, loginValidation, changePasswordValidation };
