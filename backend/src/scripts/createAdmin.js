// Usage (never via HTTP):
//   ADMIN_NAME="Site Admin" ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
// Credentials come from the environment so nothing secret is stored in code.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

(async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in the environment.");
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 12 || Buffer.byteLength(ADMIN_PASSWORD) > 72) {
    console.error("ADMIN_PASSWORD must be 12-72 bytes.");
    process.exit(1);
  }
  await connectDB();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.findOne({ email })) {
    console.error("A user with this email already exists. Nothing changed.");
    await mongoose.disconnect();
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, Number(process.env.BCRYPT_ROUNDS || 12));
  await User.create({ name: ADMIN_NAME.trim(), email, passwordHash, role: "admin" });
  console.log(`Admin created: ${email}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
