import { useMemo } from "react";
import { useTripTracking } from "../hooks/useTripTracking";
import { ago, fmtClock, fmtDayLong, fmtTime } from "../lib/format";
import { compact, mapMarkerFromLocation } from "../lib/map";
import MapView from "./MapView";
import { Alert, Badge, Card, DL, Loading } from "./ui";

const CONNECTION = { live: ["Live connection", "bg-emerald-500"], reconnecting: ["Reconnecting — refreshing every 10 s", "bg-amber-500"], ended: ["Tracking ended", "bg-slate-400"] };

// Map + status for one trip. Only draws what the server returned: no invented ETA, distance or position.
export default function TrackingPanel({ tripId, height = 420, showDriver = true }) {
  const t = useTripTracking(tripId);
  const { tracking: tr, location } = t;
  const markers = useMemo(() => compact([
    mapMarkerFromLocation("p", "pickup", tr?.pickupLocation, "Pickup"), mapMarkerFromLocation("d", "drop", tr?.dropLocation, "Drop"),
    mapMarkerFromLocation("v", "driver", location, "Driver"),
  ]), [tr, location]);

  if (t.loading) return <Loading label="Loading trip…" />;
  if (t.error && !tr) return <Alert>{t.error}</Alert>;
  if (!tr) return null;

  const [connLabel, dot] = CONNECTION[t.connection];
  const message = {
    not_started: "The driver has not started this trip yet. The driver's location will appear here once the trip begins.",
    completed: "This trip is complete. Live tracking has ended.",
    cancelled: "This trip was cancelled. There is no live tracking.",
    active: !location ? "The trip is in progress, but no location has been received yet." : t.driverOffline ? "The driver's location sharing is currently disconnected. The last known position is shown." : null,
  }[t.state];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {message && <Alert kind={t.state === "active" ? "warning" : "info"}>{message}</Alert>}
        <MapView markers={markers} fitKey={tripId} height={height} follow label="Trip map" />
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${dot}`} />{connLabel}</span>
          <span>Last update: {location ? `${fmtClock(t.lastUpdate)} (${ago(t.lastUpdate)})` : "none"}</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-green-600" />Pickup</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-600" />Drop</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-700" />Driver</span>
        </p>
      </div>
      <Card title="Trip" className="h-fit">
        <DL cols={1} items={[
          ["Status", <Badge key="s" value={tr.status} />], ["Date", fmtDayLong(tr.date)], ["Pickup time", fmtTime(tr.pickupTime)],
          ["Pickup", tr.pickupLocation?.address], ["Drop", tr.dropLocation?.address],
          showDriver && ["Driver", tr.driver ? `${tr.driver.name}${tr.driver.phone ? ` · ${tr.driver.phone}` : ""}` : "Not assigned yet"],
        ]} />
      </Card>
    </div>
  );
}
