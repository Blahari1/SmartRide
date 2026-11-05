const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Same checks as middleware/authMiddleware.js, for non-HTTP callers (Socket.IO handshake).
async function verifyToken(token) {
  if (!token || typeof token !== "string") throw new Error("Authentication required");
  const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "smartride-api", audience: "smartride-client" });
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.role !== payload.role) throw new Error("Invalid or inactive account");
  return { id: user._id.toString(), role: user.role, name: user.name, email: user.email, exp: payload.exp };
}

module.exports = { verifyToken };
