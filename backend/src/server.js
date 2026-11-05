require("dotenv").config();

const http = require("http");
const app = require("./app");
const sockets = require("./sockets");
const connectDB = require("./config/db");
const maintenance = require("./jobs/maintenance");

const PORT = Number(process.env.PORT) || 5001;

async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    if (Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32) {
      throw new Error("JWT_SECRET must contain at least 32 bytes");
    }

    await connectDB();

    const server = http.createServer(app);
    sockets.attach(server);

    server.listen(PORT, () => {
      console.log(`SmartRide API running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      maintenance.start();
    });
  } catch (error) {
    console.error("SmartRide startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
