// Read-only check: lists admin accounts (never prints password hashes).
//   cd backend && npm run list-admins
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
(async () => {
  try {
    await connectDB();
    const admins = await User.find({ role: "admin" }).select("name email isActive createdAt").lean();
    if (!admins.length) console.log('No admin exists. Create one with: ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run create-admin');
    else admins.forEach((a) => console.log(`${a.email}  name="${a.name}"  active=${a.isActive}  created=${a.createdAt.toISOString()}`));
  } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await mongoose.disconnect(); }
})();
