import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emitAck, getSocket } from "../lib/socket";
import { postLocation } from "../services/tripService";
import { LocationShareContext } from "./locationShareStore";

const MIN_SEND_MS = 3000; // at most one position every 3 s (server allows 1/s)

// Driver-only. Owns the browser geolocation watch so sharing continues while the driver moves between pages.
// Sharing only ever starts for ONE trip the driver chose to share, and stops on stop(), on trip completion, or when the
// server says the trip is no longer active. Nothing is sent when no trip is being shared.
export function LocationShareProvider({ children }) {
  const [tripId, setTripId] = useState(null);
  const [state, setState] = useState("idle"); // idle | requesting | sharing | error
  const [error, setError] = useState("");
  const [lastSent, setLastSent] = useState(null);
  const [position, setPosition] = useState(null);
  const watch = useRef(null);
  const lastAt = useRef(0);
  const trip = useRef(null);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; trip.current = null; setTripId(null); setState("idle"); setPosition(null);
  }, []);

  const send = useCallback(async (coords) => {
    const body = { tripId: trip.current, latitude: coords.latitude, longitude: coords.longitude };
    if (Number.isFinite(coords.accuracy)) body.accuracy = coords.accuracy;
    if (Number.isFinite(coords.heading) && coords.heading >= 0) body.heading = coords.heading;
    if (Number.isFinite(coords.speed) && coords.speed >= 0) body.speed = coords.speed;
    try {
      const s = getSocket();
      if (s && s.connected) await emitAck("location:update", body);
      else { const { tripId: id, ...rest } = body; await postLocation(id, rest); } // REST fallback when the socket is down
      setLastSent(new Date()); setError("");
    } catch (e) {
      if (/in progress|not found/i.test(e.message)) { stop(); setError("Sharing stopped because the trip is no longer in progress."); setState("error"); }
      else setError(e.message);
    }
  }, [stop]);

  const start = useCallback((id) => {
    if (!("geolocation" in navigator)) { setState("error"); setError("This device or browser does not support location sharing."); return; }
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    trip.current = id; setTripId(id); setState("requesting"); setError("");
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setState("sharing"); setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy });
        if (Date.now() - lastAt.current >= MIN_SEND_MS) { lastAt.current = Date.now(); send(p.coords); }
      },
      (e) => {
        const msg = { 1: "Location permission was denied. Allow location access in your browser settings to share your position.", 2: "Your position is unavailable. Check that GPS or location services are on.", 3: "Timed out while getting your position." }[e.code] || "Could not read your location.";
        if (e.code === 1) { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; trip.current = null; setTripId(null); setState("error"); }
        setError(msg);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [send]);

  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  const value = useMemo(() => ({ tripId, state, error, lastSent, position, start, stop }), [tripId, state, error, lastSent, position, start, stop]);
  return <LocationShareContext.Provider value={value}>{children}</LocationShareContext.Provider>;
}
