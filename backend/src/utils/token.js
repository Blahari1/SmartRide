const jwt = require("jsonwebtoken");

function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      issuer: "smartride-api",
      audience: "smartride-client",
    },
  );
}

module.exports = { createAccessToken };
