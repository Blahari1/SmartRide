// Thin wrapper around the Socket.IO server. Every function is a safe no-op until sockets/index.js registers the server,
// so services (and offline tests) can call it without caring whether real-time delivery is available.
let io = null;
const setIO = (server) => { io = server; };
const safe = (fn) => { try { if (io) fn(io); } catch (e) { console.error("Realtime emit failed:", e.message); } };

const toUser = (userId, event, payload) => safe((s) => s.to(`user:${userId}`).emit(event, payload));

// A trip changed state: customer room, trip room (driver/customer/admin viewers) and the admin live board are told.
const tripStatus = (trip) => safe((s) => {
  const payload = { tripId: String(trip._id), status: trip.status, at: new Date().toISOString() };
  s.to(`trip:${trip._id}`).to(`user:${trip.userId}`).to("admin:live").emit("trip:status", payload);
});

// Tracking is over (completed / cancelled): tell viewers and remove every socket from the trip room.
const endTracking = (tripId, reason) => safe((s) => {
  s.to(`trip:${tripId}`).to("admin:live").emit("tracking:ended", { tripId: String(tripId), reason, at: new Date().toISOString() });
  s.in(`trip:${tripId}`).socketsLeave(`trip:${tripId}`);
});

const location = (tripId, loc) => safe((s) => s.to(`trip:${tripId}`).to("admin:live").emit("location:update", { tripId: String(tripId), ...loc }));
const driverOffline = (tripId) => safe((s) => s.to(`trip:${tripId}`).to("admin:live").emit("tracking:driver-offline", { tripId: String(tripId), at: new Date().toISOString() }));

module.exports = { setIO, toUser, tripStatus, endTracking, location, driverOffline };
