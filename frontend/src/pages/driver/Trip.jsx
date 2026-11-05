import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync, useAction } from "../../hooks/useAsync";
import { useLocationShare } from "../../context/locationShareStore";
import { driverTrips, setTripStatus } from "../../services/scheduleService";
import MapView from "../../components/MapView";
import { Alert, Async, Badge, Button, Card, ConfirmDialog, DL, EmptyState, PageHeader, Select } from "../../components/ui";
import { compact, directionsUrl, mapMarkerFromLocation } from "../../lib/map";
import { ago, fmtClock, fmtDay, fmtTime, hasCoords, todayIst } from "../../lib/format";

function useCurrentTrips() {
  const state = useAsync(() => driverTrips({ include: "all", status: undefined }).then((r) => r.trips.filter((t) => ["confirmed", "in_progress"].includes(t.status) && t.date <= todayIst())), "current");
  return state;
}

function ShareControls({ trip }) {
  const share = useLocationShare();
  const sharingThis = share.tripId === trip.id;
  const text = { idle: "Not sharing", requesting: "Waiting for location permission…", sharing: "Sharing live location", error: "Not sharing" }[sharingThis ? share.state : share.state === "error" ? "error" : "idle"];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${sharingThis && share.state === "sharing" ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} /><b>{text}</b></div>
      {sharingThis && share.state === "sharing" && <p className="text-xs text-slate-500">Last sent: {share.lastSent ? `${fmtClock(share.lastSent)} (${ago(share.lastSent)})` : "waiting for first update"}{share.position?.accuracy ? ` · accuracy ±${Math.round(share.position.accuracy)} m` : ""}</p>}
      <Alert kind="warning">{share.error}</Alert>
      <div className="flex flex-wrap gap-2">
        {!sharingThis || share.state === "idle" || share.state === "error" ? <Button variant="primary" disabled={trip.status !== "in_progress"} onClick={() => share.start(trip.id)}>Start sharing location</Button> : <Button variant="secondary" onClick={share.stop}>Stop sharing</Button>}
      </div>
      {trip.status !== "in_progress" && <p className="text-xs text-slate-500">Location can only be shared while the trip is in progress. It is never shared outside an active trip.</p>}
      <p className="text-xs text-slate-500">Your position is sent only to the customer on this trip and to administrators, only while sharing is on.</p>
    </div>
  );
}

export function ActiveTrip() {
  const state = useCurrentTrips();
  const share = useLocationShare();
  const act = useAction();
  const [dialog, setDialog] = useState(null);
  return (
    <>
      <PageHeader title="Active trip" subtitle="Start your trip, share your location, and complete it on arrival." />
      <Alert>{act.error}</Alert><Alert kind="success">{act.success}</Alert>
      <Async state={state}>{(trips) => {
        const trip = trips.find((t) => t.status === "in_progress") || trips.find((t) => t.date === todayIst());
        if (!trip) return <EmptyState icon="car" title="No trip to run right now" hint="Confirmed trips for today appear here." action={<Link className="text-sm font-semibold text-blue-700" to="/driver/schedule/upcoming">View upcoming schedule</Link>} />;
        const markers = compact([mapMarkerFromLocation("p", "pickup", trip.pickupLocation, "Pickup"), mapMarkerFromLocation("d", "drop", trip.dropLocation, "Drop"), share.tripId === trip.id && share.position ? { id: "y", kind: "driver", lat: share.position.latitude, lng: share.position.longitude, title: "You" } : null]);
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <MapView markers={markers} fitKey={trip.id} follow height={400} label="Active trip map" />
              {hasCoords(trip.pickupLocation) && hasCoords(trip.dropLocation) && <p className="text-sm"><a className="font-semibold text-blue-700 hover:underline" target="_blank" rel="noreferrer" href={directionsUrl(trip.pickupLocation, trip.dropLocation)}>Open pickup → drop directions in OpenStreetMap</a></p>}
            </div>
            <div className="space-y-6">
              <Card title="Trip"><DL cols={1} items={[["Customer", `${trip.customer?.name || "—"}${trip.customer?.phone ? ` · ${trip.customer.phone}` : ""}`], ["When", `${fmtDay(trip.date)} · ${fmtTime(trip.pickupTime)}`], ["Pickup", trip.pickupLocation?.address], ["Drop", trip.dropLocation?.address], ["Status", <Badge key="s" value={trip.status} />]]} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {trip.status === "confirmed" && <Button variant="primary" disabled={trip.date !== todayIst()} onClick={() => { act.clear(); setDialog("start"); }}>Start trip</Button>}
                  {trip.status === "in_progress" && <Button variant="success" onClick={() => { act.clear(); setDialog("complete"); }}>Complete trip</Button>}
                  <Link className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" to={`/driver/trips/${trip.id}`}>Details</Link>
                </div></Card>
              <Card title="Location sharing"><ShareControls trip={trip} /></Card>
            </div>
            <ConfirmDialog open={dialog === "start"} title="Start this trip?" confirmLabel="Start trip" busy={act.busy} onCancel={() => setDialog(null)} message="The customer is notified. You can then start sharing your live location."
              onConfirm={async () => { if (await act.run(() => setTripStatus(trip.id, "in_progress"), "Trip started.")) { setDialog(null); state.reload(); share.start(trip.id); } }} />
            <ConfirmDialog open={dialog === "complete"} title="Complete this trip?" confirmLabel="Complete trip" busy={act.busy} onCancel={() => setDialog(null)} message="Location sharing stops and the customer can rate the trip."
              onConfirm={async () => { const ok = await act.run(() => setTripStatus(trip.id, "completed"), "Trip completed."); if (ok) share.stop(); setDialog(null); state.reload(); }} />
          </div>
        );
      }}</Async>
    </>
  );
}

export function DriverMap() {
  const state = useCurrentTrips();
  const share = useLocationShare();
  const [sel, setSel] = useState("");
  const [here, setHere] = useState(null);
  const [geoError, setGeoError] = useState("");
  return (
    <>
      <PageHeader title="Map & navigation" subtitle="Pickup and drop points for your current trips." />
      <Async state={state}>{(trips) => {
        if (!trips.length) return <EmptyState icon="nav" title="No current trips" hint="Confirmed trips for today appear here." />;
        const trip = trips.find((t) => t.id === sel) || trips.find((t) => t.status === "in_progress") || trips[0];
        const me = share.tripId === trip.id && share.position ? { latitude: share.position.latitude, longitude: share.position.longitude } : here;
        const locate = () => { setGeoError(""); navigator.geolocation?.getCurrentPosition((p) => setHere({ latitude: p.coords.latitude, longitude: p.coords.longitude }), (e) => setGeoError(e.code === 1 ? "Location permission was denied." : "Your position is unavailable."), { enableHighAccuracy: true, timeout: 15000 }); };
        return (
          <MapPage trips={trips} trip={trip} me={me} sel={trip.id} setSel={setSel} locate={locate} geoError={geoError} />
        );
      }}</Async>
    </>
  );
}

function MapPage({ trips, trip, me, sel, setSel, locate, geoError }) {
  const markers = useMemo(() => compact([mapMarkerFromLocation("p", "pickup", trip.pickupLocation, "Pickup"), mapMarkerFromLocation("d", "drop", trip.dropLocation, "Drop"), me && { id: "y", kind: "you", lat: me.latitude, lng: me.longitude, title: "You" }]), [trip, me]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2"><MapView markers={markers} fitKey={sel} height={460} label="Navigation map" /></div>
      <div className="space-y-6">
        <Card title="Trip"><div className="space-y-3">
          {trips.length > 1 && <Select label="Trip" value={sel} onChange={setSel} options={trips.map((t) => [t.id, `${fmtDay(t.date)} ${fmtTime(t.pickupTime)} · ${t.customer?.name}`])} />}
          <DL cols={1} items={[["Pickup", trip.pickupLocation?.address], ["Drop", trip.dropLocation?.address]]} />
          <Alert kind="warning">{geoError}</Alert>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={locate}>Show my position</Button>
            {me && hasCoords(trip.pickupLocation) && <a className="inline-flex items-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800" target="_blank" rel="noreferrer" href={directionsUrl(me, trip.pickupLocation)}>Directions to pickup</a>}
            {hasCoords(trip.pickupLocation) && hasCoords(trip.dropLocation) && <a className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" target="_blank" rel="noreferrer" href={directionsUrl(trip.pickupLocation, trip.dropLocation)}>Pickup → drop</a>}</div>
          <p className="text-xs text-slate-500">Directions open in OpenStreetMap. SmartRide does not calculate routes, distance or ETA.</p>
        </div></Card>
      </div>
    </div>
  );
}

export function LocationSharing() {
  const state = useCurrentTrips();
  const share = useLocationShare();
  return (
    <>
      <PageHeader title="Location sharing" subtitle="Share your position with the customer and administrators during an active trip only." />
      <Async state={state}>{(trips) => {
        const active = trips.find((t) => t.status === "in_progress");
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Controls">{active ? <><p className="mb-3 text-sm text-slate-600">Trip: {fmtDay(active.date)} · {fmtTime(active.pickupTime)} · {active.customer?.name}</p><ShareControls trip={active} /></> : <EmptyState icon="radio" title="No trip in progress" hint="Start a trip first. Sharing is not possible outside an active trip." action={<Link className="text-sm font-semibold text-blue-700" to="/driver/active-trip">Go to active trip</Link>} />}</Card>
            <Card title="Privacy and permissions"><ul className="space-y-2 text-sm text-slate-600"><li>• Your browser asks for permission the first time. If you deny it, enable location for this site in the browser settings.</li><li>• Sharing stops automatically when the trip is completed or cancelled, or when you press Stop.</li><li>• Keep this tab open while driving; closing the browser stops sharing.</li><li>• Current state: <b>{share.state}</b></li></ul></Card>
          </div>
        );
      }}</Async>
    </>
  );
}
