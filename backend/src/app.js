const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profileRoutes");
const subscriptionPlanRoutes = require("./routes/subscriptionPlanRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const driverRoutes = require("./routes/driverRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const tripRoutes = require("./routes/tripRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const customerRoutes = require("./routes/customerRoutes");
const pricingRoutes = require("./routes/pricingRoutes");
const { errorHandler } = require("./utils/validate");

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "20kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SmartRide backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    project: "SmartRide",
    server: "running",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    port: Number(process.env.PORT) || 5001,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/subscription-plans", subscriptionPlanRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/pricing", pricingRoutes);

// 404 and error handlers must stay LAST (the previous version registered
// /api/subscription-plans after them, which made those routes unreachable).
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use(errorHandler);

module.exports = app;
