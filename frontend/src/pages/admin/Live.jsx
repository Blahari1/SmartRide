import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { emitAck, getSocket } from "../../lib/socket";
import { activeTrips } from "../../services/tripService";
import MapView from "../../components/MapView";
import { Alert, Badge, Card, DL, EmptyState, Loading, PageHeader } from "../../components/ui";
import { ago, fmtClock, fmtTime, hasCoords } from "../../lib/format";

// Live board for admins: initial list over the socket ("admin:subscribe"), then location:update / trip:status /
// tracking:ended events. While the socket is down the board polls the REST endpoint every 10 s.
export default function LiveTrips() {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [sel, setSel] = useState(null);
  const [, setTick] = useState(0);
  const offline = useRef(new Set());

  const poll = useCallback(() => activeTrips().then((r) => { setTrips(r.trips); setError(""); }).catch((e) => setError(e.message)), []);

  useEffect(() => {
    const s = getSocket();
    const join = () => emitAck("admin:subscribe", {}).then((r) => { setTrips(r.trips); setConnected(true); setError(""); }).catch((e) => setError(e.message));
    const onLoc = (p) => { offline.current.delete(p.tripId); setTrips((list) => (list ? list.map((t) => (t.tripId === p.tripId ? { ...t, location: { latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, heading: p.heading, speed: p.speed, updatedAt: p.updatedAt } } : t)) : list)); };
    const onStatus = () => poll(); // a trip started/ended: reload the list
    const onEnded = (p) => setTrips((list) => (list ? list.filter((t) => t.tripId !== p.tripId) : list));
    const onOff = (p) => { offline.current.add(p.tripId); setTick((n) => n + 1); };
    const onDown = () => setConnected(false);
    const first = setTimeout(poll, 0);
    if (s) { s.on("location:update", onLoc); s.on("trip:status", onStatus); s.on("tracking:ended", onEnded); s.on("tracking:driver-offline", onOff); s.on("connect", join); s.on("disconnect", onDown); if (s.connected) join(); }
    const timer = setInterval(() => { if (!s || !s.connected) poll(); }, 10000);
    const clock = setInterval(() => setTick((n) => n + 1), 15000); // keeps "x seconds ago" fresh
    return () => { clearTimeout(first); clearInterval(timer); clearInterval(clock); if (s) { s.off("location:update", onLoc); s.off("trip:status", onStatus); s.off("tracking:ended", onEnded); s.off("tracking:driver-offline", onOff); s.off("connect", join); s.off("disconnect", onDown); } };
  }, [poll]);

  const markers = useMemo(() => (trips || []).flatMap((t) => [
    hasCoords(t.location) && { id: `v${t.tripId}`, kind: "driver", lat: t.location.latitude, lng: t.location.longitude, title: t.driver?.name || "Driver" },
    sel === t.tripId && hasCoords(t.pickupLocation) && { id: `p${t.tripId}`, kind: "pickup", lat: t.pickupLocation.latitude, lng: t.pickupLocation.longitude, title: "Pickup" },
    sel === t.tripId && hasCoords(t.dropLocation) && { id: `d${t.tripId}`, kind: "drop", lat: t.dropLocation.latitude, lng: t.dropLocation.longitude, title: "Drop" },
  ].filter(Boolean)), [trips, sel]);

  const selected = (trips || []).find((t) => t.tripId === sel);
  return (
    <>
      <PageHeader title="Live trip monitoring" subtitle="Driver locations appear only while a trip is in progress and location sharing is active." />
      <p className="mb-3 flex items-center gap-2 text-xs text-slate-500"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />{connected ? "Live connection" : "Reconnecting — refreshing every 10 s"}</p>
      <Alert>{error}</Alert>
      {!trips ? <Loading /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <MapView markers={markers} fitKey={`${sel}-${trips.length}`} height={480} label="Live trips map" />
            {trips.length === 0 && <EmptyState icon="radio" title="No trips in progress" hint="Active trips appear here as soon as a driver starts one." />}
          </div>
          <div className="space-y-4">
            <Card title={`Active trips (${trips.length})`} padded={false}><ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {trips.map((t) => (
                <li key={t.tripId}><button type="button" onClick={() => setSel(t.tripId)} className={`block w-full px-5 py-3 text-left text-sm hover:bg-slate-50 ${sel === t.tripId ? "bg-blue-50" : ""}`}>
                  <span className="font-semibold">{t.driver?.name || "Driver"}</span> → {t.customer?.name}<span className="block text-xs text-slate-500">{t.location ? `updated ${ago(t.location.updatedAt)}` : "no location yet"}{offline.current.has(t.tripId) ? " · driver offline" : ""}</span></button></li>))}
            </ul></Card>
            {selected && <Card title="Selected trip"><DL cols={1} items={[["Status", <Badge key="s" value="in_progress" />], ["Driver", `${selected.driver?.name || "—"} ${selected.driver?.phone ? `· ${selected.driver.phone}` : ""}`], ["Customer", selected.customer?.name], ["Pickup time", fmtTime(selected.pickupTime)], ["Last location update", selected.location ? `${fmtClock(selected.location.updatedAt)} (${ago(selected.location.updatedAt)})` : "None received"]]} /><Link className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline" to={`/admin/trips/${selected.tripId}`}>Trip details</Link></Card>}
          </div>
        </div>
      )}
    </>
  );
}
