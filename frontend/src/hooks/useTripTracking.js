import { useEffect, useRef, useState } from "react";
import { emitAck, getSocket } from "../lib/socket";
import { getTracking } from "../services/tripService";

// Live view of ONE trip for its customer, assigned driver or an admin.
// Returns { tracking, location, status, state, connection, lastUpdate, error }.
//  connection: "live" (socket joined) | "reconnecting" (socket down, polling every 10 s) | "ended"
export function useTripTracking(tripId) {
  const [snap, setSnap] = useState({ tripId: null, data: null, error: "" });
  const [loc, setLoc] = useState(null);
  const [connection, setConnection] = useState("reconnecting");
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!tripId) return undefined;
    const apply = (t) => { if (!alive.current) return; setSnap({ tripId, data: t, error: "" }); setLoc(t.location); if (t.state === "completed" || t.state === "cancelled") setConnection("ended"); };
    const fail = (e) => { if (alive.current) setSnap({ tripId, data: null, error: e.message }); };

    const s = getSocket();
    const join = () => emitAck("trip:subscribe", { tripId }).then((r) => { apply(r.tracking); if (r.tracking.state !== "completed" && r.tracking.state !== "cancelled") { setConnection("live"); setOffline(false); } }).catch(fail);
    const poll = () => getTracking(tripId).then((r) => apply(r.tracking)).catch(fail);

    const onLoc = (p) => { if (p.tripId === tripId) { setLoc({ latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, heading: p.heading, speed: p.speed, updatedAt: p.updatedAt }); setOffline(false); } };
    const onStatus = (p) => { if (p.tripId === tripId) poll(); }; // refetch: the server decides what this role may see
    const onEnded = (p) => { if (p.tripId === tripId) { setLoc(null); setConnection("ended"); poll(); } };
    const onOffline = (p) => { if (p.tripId === tripId) setOffline(true); };
    const onDown = () => setConnection((c) => (c === "ended" ? c : "reconnecting"));

    poll();
    let timer = null;
    if (s) {
      s.on("location:update", onLoc); s.on("trip:status", onStatus); s.on("tracking:ended", onEnded); s.on("tracking:driver-offline", onOffline);
      s.on("connect", join); s.on("disconnect", onDown);
      if (s.connected) join();
    }
    timer = setInterval(() => { if (!s || !s.connected) poll(); }, 10000); // fallback only while the socket is down

    return () => {
      alive.current = false; clearInterval(timer);
      if (s) {
        s.off("location:update", onLoc); s.off("trip:status", onStatus); s.off("tracking:ended", onEnded); s.off("tracking:driver-offline", onOffline); s.off("connect", join); s.off("disconnect", onDown);
        if (s.connected) s.emit("trip:unsubscribe", { tripId });
      }
    };
  }, [tripId]);

  const mine = snap.tripId === tripId;
  const tracking = mine ? snap.data : null;
  return {
    tracking, location: loc, status: tracking?.status, state: tracking?.state, connection, driverOffline: offline,
    lastUpdate: loc?.updatedAt || null, loading: !!tripId && !mine, error: mine ? snap.error : "",
  };
}
