const { Server } = require("socket.io");
const realtime = require("../utils/realtime");
const { setEmitter } = require("../services/notificationService");
const tracking = require("../services/trackingService");
const { verifyToken } = require("../utils/verifyToken");

const MIN_UPDATE_INTERVAL_MS = 1000; // a driver socket may publish at most one position per second per trip

// Rooms: user:<userId> (notifications, trip status), trip:<tripId> (live position for authorised viewers), admin:live.
// Authorisation is checked for every subscribe and every location message; nothing is trusted from the client.
function attach(httpServer) {
  const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }, maxHttpBufferSize: 10 * 1024 });
  realtime.setIO(io);
  setEmitter((userId, notification) => realtime.toUser(userId, "notification:new", notification));

  io.use(async (socket, next) => {
    try {
      socket.data.user = await verifyToken(socket.handshake.auth && socket.handshake.auth.token);
      next();
    } catch (e) {
      next(new Error(e.name === "TokenExpiredError" ? "Session expired" : "Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    // A socket never outlives the JWT that opened it.
    const ttl = user.exp * 1000 - Date.now();
    const expiry = setTimeout(() => { socket.emit("session:expired"); socket.disconnect(true); }, Math.max(ttl, 0));
    expiry.unref();

    const published = new Map(); // tripId -> last accepted update time (also marks this socket as that trip's publisher)
    const reply = (ack, body) => { if (typeof ack === "function") ack(body); };
    const guard = (fn) => async (payload, ack) => {
      try {
        reply(ack, { ok: true, ...(await fn(payload || {})) });
      } catch (e) {
        reply(ack, { ok: false, error: e.status ? e.message : "Request failed" });
        if (!e.status) console.error("Socket handler error:", e.message);
      }
    };

    // Customer (owner), assigned driver or admin may watch a trip. Ended trips return their final state without a room.
    socket.on("trip:subscribe", guard(async ({ tripId }) => {
      const snap = await tracking.snapshot(user, tripId);
      if (snap.state === "active" || snap.state === "not_started") socket.join(`trip:${snap.tripId}`);
      return { tracking: snap };
    }));
    socket.on("trip:unsubscribe", guard(async ({ tripId }) => { if (typeof tripId === "string") socket.leave(`trip:${tripId}`); return {}; }));

    socket.on("admin:subscribe", guard(async () => {
      if (user.role !== "admin") { const e = new Error("You do not have permission to access this resource"); e.status = 403; throw e; }
      socket.join("admin:live");
      return { trips: await tracking.listActive() };
    }));

    // Driver publishes a position. The service re-checks assignment + in_progress in the same DB write.
    socket.on("location:update", guard(async (payload) => {
      if (user.role !== "driver") { const e = new Error("Only drivers can share location"); e.status = 403; throw e; }
      const { tripId, ...coords } = payload;
      const last = published.get(String(tripId));
      if (last && Date.now() - last < MIN_UPDATE_INTERVAL_MS) { const e = new Error("Location updates are limited to one per second"); e.status = 429; throw e; }
      const location = await tracking.updateLocation(user, tripId, coords);
      published.set(String(tripId), Date.now());
      return { location };
    }));

    socket.on("disconnect", () => {
      clearTimeout(expiry);
      for (const tripId of published.keys()) realtime.driverOffline(tripId);
    });
  });
  return io;
}

module.exports = { attach, MIN_UPDATE_INTERVAL_MS };
